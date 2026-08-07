import { Request } from 'express';
import Razorpay from 'razorpay';
import { BillingCycle, PlatformInvoice, PlatformInvoiceStatus, SubscriptionStatus, NotificationChannel, AuditEventType } from '@prisma/client';
import { prisma } from '@config/database';
import { razorpayClient, razorpayConfig } from '@config/razorpay';
import { BaseService } from '@shared/base';
import { PaginationMeta } from '@shared/types';
import { ForbiddenError, ServiceUnavailableError } from '@shared/errors';
import { ErrorCode } from '@shared/enums';
import { MESSAGES, BILLING, AUDIT } from '@shared/constants';
import { CryptoUtils } from '@shared/utils';
// Concrete path, not the `@modules/notifications` barrel — see
// `middlewares/tenant.middleware.ts`'s header comment for why.
import { NotificationDispatchService } from '@modules/notifications/service/notification-dispatch.service';
import { UserRepository } from '@modules/users/repository/user.repository';
import { AuditLogRecorder } from '@modules/audit';
import { PlanRepository } from '../repository/plan.repository';
import { PlatformInvoiceRepository } from '../repository/platform-invoice.repository';
import { TenantBillingRepository } from '../repository/tenant-billing.repository';
import { BillingMapper, PlatformInvoiceWithPlan } from '../mapper/billing.mapper';
import { CreateCheckoutSessionDto, ListInvoicesQueryDto, VerifyCheckoutPaymentDto } from '../dto/billing.req.dto';
import { CheckoutSessionResponseDto, PlatformInvoiceResponseDto, SubscriptionResponseDto } from '../dto/billing.res.dto';

/** How long a paid cycle lasts, in days — used to compute `subscriptionExpiresAt`/`periodEnd`.
 *  Deliberately calendar-approximate (30/90/365), not exact month/quarter/year arithmetic —
 *  matches the "deliberately minimal" scope of every other module here (no proration engine). */
const CYCLE_DAYS: Record<BillingCycle, number> = {
  MONTHLY: 30,
  QUARTERLY: 90,
  YEARLY: 365,
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Billing Service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Tenant-facing platform subscription billing: view current plan/invoices,
 * start a Razorpay checkout, and confirm payment. Two independent
 * confirmation paths both funnel into `finalizePayment()`, made idempotent
 * via the `PENDING` status guard so whichever arrives first (the client's
 * own post-checkout callback via `verifyPayment()`, or Razorpay's async
 * webhook via `handleWebhook()`) wins and the other is a safe no-op:
 *
 *   - `verifyPayment()` — the primary path. Verifies the
 *     `order_id|payment_id` HMAC signed with `RAZORPAY_KEY_SECRET`, exactly
 *     as Razorpay's Checkout.js hands back to the browser on success.
 *   - `handleWebhook()` — a defense-in-depth backup for when the browser
 *     never returns (closed tab, network drop) — verifies the payload HMAC
 *     signed with the separate `RAZORPAY_WEBHOOK_SECRET`. A no-op (logged,
 *     not thrown) if that secret isn't configured, since local dev has no
 *     public URL for Razorpay to call anyway.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class BillingService extends BaseService {
  constructor(
    req: Request,
    private readonly planRepository: PlanRepository = new PlanRepository(prisma),
    private readonly invoiceRepository: PlatformInvoiceRepository = new PlatformInvoiceRepository(prisma),
    private readonly tenantBillingRepository: TenantBillingRepository = new TenantBillingRepository(prisma),
    private readonly userRepository: UserRepository = new UserRepository(prisma),
    private readonly notificationDispatchService: NotificationDispatchService = new NotificationDispatchService(),
    private readonly auditLogRecorder: AuditLogRecorder = new AuditLogRecorder(),
  ) {
    super(req);
  }

  async getSubscription(): Promise<SubscriptionResponseDto> {
    const tenant = await this.tenantBillingRepository.findById(this.requireTenantId());
    this.validateExists(tenant, 'Tenant');

    const plan = tenant.planCode ? await this.planRepository.findByCode(tenant.planCode) : null;
    return BillingMapper.toSubscriptionResponseDto(tenant, plan);
  }

  async listInvoices(query: ListInvoicesQueryDto): Promise<{ data: PlatformInvoiceResponseDto[]; meta: PaginationMeta }> {
    const { data, meta } = await this.invoiceRepository.paginateWithPlan(
      { page: query.page, limit: query.limit, sortBy: query.sortBy, sortOrder: query.sortOrder },
      { tenantId: this.tenantId },
    );
    return { data: BillingMapper.toInvoiceResponseDtoList(data), meta };
  }

  async createCheckoutSession(dto: CreateCheckoutSessionDto): Promise<CheckoutSessionResponseDto> {
    this.requireRazorpayConfigured();

    const plan = await this.planRepository.findByCode(dto.planCode);
    this.validateExists(plan, 'Plan');
    if (!plan.isActive) {
      this.throwNotFound('Plan');
    }

    const tenantId = this.requireTenantId();
    this.logger.info({ planCode: dto.planCode }, 'Creating Razorpay checkout order');

    const order = await razorpayClient.orders.create({
      amount: plan.priceInPaise,
      currency: BILLING.CURRENCY,
      receipt: `tenant_${tenantId}_${Date.now()}`.slice(0, 40),
      notes: { tenantId, planCode: plan.code },
    });

    const invoice = await this.invoiceRepository.create(
      {
        planId: plan.id,
        billingCycle: plan.billingCycle,
        amountInPaise: plan.priceInPaise,
        razorpayOrderId: order.id,
      },
      { tenantId },
    );

    return {
      invoiceId: invoice.id,
      razorpayOrderId: order.id,
      amountInPaise: plan.priceInPaise,
      currency: BILLING.CURRENCY,
      razorpayKeyId: razorpayConfig.keyId,
    };
  }

  async verifyPayment(dto: VerifyCheckoutPaymentDto): Promise<SubscriptionResponseDto> {
    this.requireRazorpayConfigured();

    const invoice = await this.invoiceRepository.findByRazorpayOrderId(dto.razorpayOrderId);
    this.validateExists(invoice, 'Invoice');

    if (invoice.tenantId !== this.requireTenantId()) {
      throw new ForbiddenError('This invoice does not belong to your organisation');
    }

    if (invoice.status === PlatformInvoiceStatus.PAID) {
      // Already confirmed (e.g. the webhook beat this call to it) — idempotent no-op.
      return this.getSubscription();
    }

    const expectedSignature = CryptoUtils.hmacSha256Hex(
      `${dto.razorpayOrderId}|${dto.razorpayPaymentId}`,
      razorpayConfig.keySecret,
    );
    if (!CryptoUtils.timingSafeEqualHex(expectedSignature, dto.razorpaySignature)) {
      throw new ForbiddenError('Payment signature verification failed', ErrorCode.FORBIDDEN);
    }

    await this.finalizePayment(invoice, dto.razorpayPaymentId, dto.razorpaySignature);
    return this.getSubscription();
  }

  /**
   * Razorpay webhook receiver. `rawBody` is the exact byte sequence Razorpay
   * signed (captured by `express.json()`'s `verify` callback in `app.ts`) —
   * never the re-parsed `req.body` object, which would fail HMAC verification.
   */
  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined): Promise<void> {
    if (!razorpayConfig.webhookSecret) {
      this.logger.warn('Received a Razorpay webhook but RAZORPAY_WEBHOOK_SECRET is not configured — ignoring');
      return;
    }
    if (!rawBody || !signature) {
      throw new ForbiddenError('Missing webhook signature');
    }

    const isValid = Razorpay.validateWebhookSignature(rawBody.toString(), signature, razorpayConfig.webhookSecret);
    if (!isValid) {
      throw new ForbiddenError('Invalid webhook signature');
    }

    const payload = JSON.parse(rawBody.toString()) as {
      event: string;
      payload: { payment: { entity: { id: string; order_id: string } } };
    };
    if (payload.event !== 'payment.captured') return;

    const { id: paymentId, order_id: orderId } = payload.payload.payment.entity;
    const invoice = await this.invoiceRepository.findByRazorpayOrderId(orderId);
    if (!invoice || invoice.status === PlatformInvoiceStatus.PAID) return; // Unknown order, or already confirmed via verifyPayment().

    await this.finalizePayment(invoice, paymentId, signature);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Shared confirmation logic
  // ────────────────────────────────────────────────────────────────────────────

  private async finalizePayment(
    invoice: PlatformInvoiceWithPlan,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ): Promise<PlatformInvoice> {
    const periodStart = new Date();
    const periodEnd = new Date(periodStart.getTime() + CYCLE_DAYS[invoice.billingCycle] * 24 * 60 * 60 * 1000);

    this.logger.info({ tenantId: invoice.tenantId, planCode: invoice.plan.code }, 'Confirming platform subscription payment');

    const [paidInvoice] = await Promise.all([
      this.invoiceRepository.markPaid(invoice.id, { razorpayPaymentId, razorpaySignature, periodStart, periodEnd }),
      this.tenantBillingRepository.applyPlan(invoice.tenantId, {
        planCode: invoice.plan.code,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        subscriptionExpiresAt: periodEnd,
        maxUsers: invoice.plan.maxUsers,
        maxClients: invoice.plan.maxClients,
        maxStorageGb: invoice.plan.maxStorageGb,
        maxDocuments: invoice.plan.maxDocuments,
        maxUploadSizeMb: invoice.plan.maxUploadSizeMb,
      }),
    ]);

    // Reached only once per invoice — both call sites (`verifyPayment()`,
    // `handleWebhook()`) guard on `invoice.status === PAID` before ever
    // calling this method, so a webhook replay or a duplicate client
    // confirmation never re-enters here. Unlike this module's other
    // notifications, this one is *not* skipped when the actor is also the
    // recipient — "your payment succeeded, subscription active" is a
    // legitimate confirmation to send to the person who just paid, not a
    // self-action they already know about (e.g. an assignment they made).
    await this.notifyOwner(invoice.tenantId, 'Subscription activated', `Your ${invoice.plan.name} subscription is now active.`);

    // `this.userId` is only populated when this path was reached via `verifyPayment()`
    // (an authenticated request) — `handleWebhook()` has no `req.user`, so it falls back
    // to the system actor, same convention as the client-billing gateway webhook.
    await this.auditLogRecorder.record({
      tenantId: invoice.tenantId,
      actorId: this.userId ?? AUDIT.SYSTEM_ACTOR_ID,
      actorName: this.userId ? undefined : AUDIT.SYSTEM_ACTOR_NAME,
      eventType: AuditEventType.SUBSCRIPTION_UPDATED,
      description: `Subscription updated to plan "${invoice.plan.code}"`,
      targetType: 'Tenant',
      targetId: invoice.tenantId,
      ipAddress: this.req.ip ?? null,
      userAgent: (this.req.headers?.['user-agent'] as string | undefined) ?? null,
      newValue: { planCode: invoice.plan.code, subscriptionStatus: SubscriptionStatus.ACTIVE, subscriptionExpiresAt: periodEnd.toISOString() },
    });

    return paidInvoice;
  }

  private requireTenantId(): string {
    if (!this.tenantId) throw new ForbiddenError(MESSAGES.FORBIDDEN);
    return this.tenantId;
  }

  private requireRazorpayConfigured(): void {
    if (!razorpayConfig.isConfigured) {
      throw new ServiceUnavailableError(
        'Payment processing is not configured on this server yet',
        ErrorCode.DEPENDENCY_UNAVAILABLE,
      );
    }
  }

  /** IN_APP-only — no PRD text mandates EMAIL/SMS/WhatsApp for this event. Best-effort: never fails the primary action. */
  private async notifyOwner(tenantId: string, title: string, message: string): Promise<void> {
    const owner = await this.userRepository.findOwnerByTenant(tenantId);
    if (!owner) return;

    try {
      await this.notificationDispatchService.send({ tenantId, userId: owner.id, title, message, channels: [NotificationChannel.IN_APP] });
    } catch (err) {
      this.logger.warn({ err, tenantId, title }, 'Failed to dispatch notification');
    }
  }
}
