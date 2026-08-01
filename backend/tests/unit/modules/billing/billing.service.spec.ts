jest.mock('@config/database', () => ({ prisma: {} }));

jest.mock('@config/razorpay', () => ({
  razorpayClient: { orders: { create: jest.fn() } },
  razorpayConfig: {
    keyId: 'rzp_test_fake',
    keySecret: 'test_key_secret',
    webhookSecret: undefined as string | undefined,
    isConfigured: true,
  },
}));

jest.mock('razorpay', () => ({ validateWebhookSignature: jest.fn() }));

import crypto from 'crypto';
import { Request } from 'express';
import Razorpay from 'razorpay';
import { BillingCycle, Plan, PlatformInvoice, PlatformInvoiceStatus, SubscriptionStatus, Tenant, TenantStatus, NotificationChannel } from '@prisma/client';
import { ForbiddenError, NotFoundError, ServiceUnavailableError } from '@shared/errors';
import { razorpayClient, razorpayConfig } from '@config/razorpay';
import { BillingService } from '@modules/billing/service/billing.service';
import { PlanRepository } from '@modules/billing/repository/plan.repository';
import { PlatformInvoiceRepository } from '@modules/billing/repository/platform-invoice.repository';
import { TenantBillingRepository } from '@modules/billing/repository/tenant-billing.repository';
import { PlatformInvoiceWithPlan } from '@modules/billing/mapper/billing.mapper';
import { UserRepository } from '@modules/users/repository/user.repository';
import type { NotificationDispatchService } from '@modules/notifications/service/notification-dispatch.service';
import type { CreateCheckoutSessionDto, VerifyCheckoutPaymentDto } from '@modules/billing/dto/billing.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * BillingService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every repository AND the Razorpay SDK itself are fully mocked — exercises
 * only `BillingService`'s business logic (config guards, ownership checks,
 * idempotency, and the actual signature-verification math, computed here
 * with the real `crypto` module against the same fake `keySecret` the mock
 * config exposes) — never a real database or network call. Mirrors
 * `tests/unit/modules/auth/auth.service.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const OTHER_TENANT_ID = 'tenant-99999999-9999-9999-9999-999999999999';
const PLAN_ID = 'plan-22222222-2222-2222-2222-222222222222';
const INVOICE_ID = 'invoice-33333333-3333-3333-3333-333333333333';

type MockedPlanRepository = { [K in keyof PlanRepository]: jest.Mock };
type MockedInvoiceRepository = { [K in keyof PlatformInvoiceRepository]: jest.Mock };
type MockedTenantBillingRepository = { [K in keyof TenantBillingRepository]: jest.Mock };

function createMockPlanRepository(): MockedPlanRepository {
  return {
    listActive: jest.fn(),
    listAllWithTenantCount: jest.fn(),
    findByCode: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  } as unknown as MockedPlanRepository;
}

function createMockInvoiceRepository(): MockedInvoiceRepository {
  return {
    findById: jest.fn(),
    findByRazorpayOrderId: jest.fn(),
    paginateWithPlan: jest.fn(),
    create: jest.fn(),
    markPaid: jest.fn(),
  } as unknown as MockedInvoiceRepository;
}

function createMockTenantBillingRepository(): MockedTenantBillingRepository {
  return { findById: jest.fn(), applyPlan: jest.fn() } as unknown as MockedTenantBillingRepository;
}

function createFakeRequest(tenantId: string | undefined = TENANT_ID): Request {
  return {
    tenant: tenantId ? { id: tenantId, slug: 'acme', name: 'Acme & Co', planCode: null, isActive: true } : undefined,
    user: { id: 'user-1', email: 'owner@acme.test', role: 'TENANT_ADMIN', tenantId, permissions: [] },
    correlationId: 'test-correlation-id',
  } as unknown as Request;
}

function createMockPlan(overrides: Partial<Plan> = {}): Plan {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: PLAN_ID,
    code: 'PROFESSIONAL_MONTHLY',
    name: 'Professional',
    billingCycle: BillingCycle.MONTHLY,
    priceInPaise: 249_900,
    maxUsers: 15,
    maxClients: 500,
    maxStorageGb: 50,
    maxDocuments: 10_000,
    isActive: true,
    displayOrder: 2,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createMockInvoice(overrides: Partial<PlatformInvoiceWithPlan> = {}): PlatformInvoiceWithPlan {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const base: PlatformInvoice = {
    id: INVOICE_ID,
    tenantId: TENANT_ID,
    planId: PLAN_ID,
    billingCycle: BillingCycle.MONTHLY,
    amountInPaise: 249_900,
    status: PlatformInvoiceStatus.PENDING,
    razorpayOrderId: 'order_fake123',
    razorpayPaymentId: null,
    razorpaySignature: null,
    periodStart: null,
    periodEnd: null,
    paidAt: null,
    createdAt: now,
    updatedAt: now,
  };
  return { ...base, plan: createMockPlan(), ...overrides };
}

function createMockTenant(overrides: Partial<Tenant> = {}): Tenant {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: TENANT_ID,
    slug: 'acme',
    name: 'Acme & Co',
    country: 'IN',
    timezone: 'Asia/Kolkata',
    locale: 'en-IN',
    defaultCurrency: 'INR',
    status: TenantStatus.ACTIVE,
    subscriptionStatus: SubscriptionStatus.ACTIVE,
    subscriptionExpiresAt: null,
    planCode: 'PROFESSIONAL_MONTHLY',
    maxUsers: 15,
    maxClients: 500,
    maxStorageGb: 50,
    maxDocuments: 10_000,
    onboardingCompletedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  } as Tenant;
}

/** Returns `null` (no owner found) by default — sufficient for `notifyOwner()`'s best-effort dispatch to no-op cleanly, since it isn't the subject of these tests. */
function createMockUserRepository(): { findOwnerByTenant: jest.Mock } {
  return { findOwnerByTenant: jest.fn().mockResolvedValue(null) };
}

function createMockNotificationDispatchService(): { send: jest.Mock } {
  return { send: jest.fn().mockResolvedValue([]) };
}

function createService(
  req: Request,
  planRepo: MockedPlanRepository,
  invoiceRepo: MockedInvoiceRepository,
  tenantRepo: MockedTenantBillingRepository,
  userRepo: { findOwnerByTenant: jest.Mock } = createMockUserRepository(),
  notificationDispatchService: { send: jest.Mock } = createMockNotificationDispatchService(),
): BillingService {
  return new BillingService(
    req,
    planRepo as unknown as PlanRepository,
    invoiceRepo as unknown as PlatformInvoiceRepository,
    tenantRepo as unknown as TenantBillingRepository,
    userRepo as unknown as UserRepository,
    notificationDispatchService as unknown as NotificationDispatchService,
  );
}

describe('BillingService', () => {
  afterEach(() => {
    jest.clearAllMocks();
    (razorpayConfig as { isConfigured: boolean }).isConfigured = true;
    (razorpayConfig as { webhookSecret: string | undefined }).webhookSecret = undefined;
  });

  describe('getSubscription', () => {
    it('throws NotFoundError when the tenant does not exist', async () => {
      const planRepo = createMockPlanRepository();
      const invoiceRepo = createMockInvoiceRepository();
      const tenantRepo = createMockTenantBillingRepository();
      tenantRepo.findById.mockResolvedValue(null);

      const service = createService(createFakeRequest(), planRepo, invoiceRepo, tenantRepo);
      await expect(service.getSubscription()).rejects.toThrow(NotFoundError);
    });

    it('returns the tenant status merged with its plan', async () => {
      const planRepo = createMockPlanRepository();
      const invoiceRepo = createMockInvoiceRepository();
      const tenantRepo = createMockTenantBillingRepository();
      tenantRepo.findById.mockResolvedValue(createMockTenant());
      planRepo.findByCode.mockResolvedValue(createMockPlan());

      const service = createService(createFakeRequest(), planRepo, invoiceRepo, tenantRepo);
      const result = await service.getSubscription();

      expect(planRepo.findByCode).toHaveBeenCalledWith('PROFESSIONAL_MONTHLY');
      expect(result.plan).toMatchObject({ code: 'PROFESSIONAL_MONTHLY' });
      expect(result.subscriptionStatus).toBe(SubscriptionStatus.ACTIVE);
    });

    it('returns a null plan when the tenant has no planCode yet', async () => {
      const planRepo = createMockPlanRepository();
      const invoiceRepo = createMockInvoiceRepository();
      const tenantRepo = createMockTenantBillingRepository();
      tenantRepo.findById.mockResolvedValue(createMockTenant({ planCode: null }));

      const service = createService(createFakeRequest(), planRepo, invoiceRepo, tenantRepo);
      const result = await service.getSubscription();

      expect(planRepo.findByCode).not.toHaveBeenCalled();
      expect(result.plan).toBeNull();
    });
  });

  describe('createCheckoutSession', () => {
    const dto: CreateCheckoutSessionDto = { planCode: 'PROFESSIONAL_MONTHLY' };

    it('throws ServiceUnavailableError when Razorpay is not configured', async () => {
      (razorpayConfig as { isConfigured: boolean }).isConfigured = false;
      const planRepo = createMockPlanRepository();
      const invoiceRepo = createMockInvoiceRepository();
      const tenantRepo = createMockTenantBillingRepository();

      const service = createService(createFakeRequest(), planRepo, invoiceRepo, tenantRepo);
      await expect(service.createCheckoutSession(dto)).rejects.toThrow(ServiceUnavailableError);
      expect(razorpayClient.orders.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when the plan code does not exist', async () => {
      const planRepo = createMockPlanRepository();
      planRepo.findByCode.mockResolvedValue(null);
      const invoiceRepo = createMockInvoiceRepository();
      const tenantRepo = createMockTenantBillingRepository();

      const service = createService(createFakeRequest(), planRepo, invoiceRepo, tenantRepo);
      await expect(service.createCheckoutSession(dto)).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError when the plan is inactive', async () => {
      const planRepo = createMockPlanRepository();
      planRepo.findByCode.mockResolvedValue(createMockPlan({ isActive: false }));
      const invoiceRepo = createMockInvoiceRepository();
      const tenantRepo = createMockTenantBillingRepository();

      const service = createService(createFakeRequest(), planRepo, invoiceRepo, tenantRepo);
      await expect(service.createCheckoutSession(dto)).rejects.toThrow(NotFoundError);
    });

    it('creates a Razorpay order and a PENDING invoice for the plan amount', async () => {
      const planRepo = createMockPlanRepository();
      const plan = createMockPlan();
      planRepo.findByCode.mockResolvedValue(plan);
      const invoiceRepo = createMockInvoiceRepository();
      invoiceRepo.create.mockResolvedValue(createMockInvoice());
      const tenantRepo = createMockTenantBillingRepository();

      (razorpayClient.orders.create as jest.Mock).mockResolvedValue({ id: 'order_fake123' });

      const service = createService(createFakeRequest(), planRepo, invoiceRepo, tenantRepo);
      const result = await service.createCheckoutSession(dto);

      expect(razorpayClient.orders.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: plan.priceInPaise, currency: 'INR' }),
      );
      expect(invoiceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ planId: plan.id, billingCycle: plan.billingCycle, amountInPaise: plan.priceInPaise, razorpayOrderId: 'order_fake123' }),
        { tenantId: TENANT_ID },
      );
      expect(result).toMatchObject({ razorpayOrderId: 'order_fake123', amountInPaise: plan.priceInPaise, currency: 'INR' });
    });
  });

  describe('verifyPayment', () => {
    function signaturePair(orderId: string, paymentId: string): string {
      return crypto.createHmac('sha256', 'test_key_secret').update(`${orderId}|${paymentId}`).digest('hex');
    }

    it('throws NotFoundError when no invoice matches the order id', async () => {
      const planRepo = createMockPlanRepository();
      const invoiceRepo = createMockInvoiceRepository();
      invoiceRepo.findByRazorpayOrderId.mockResolvedValue(null);
      const tenantRepo = createMockTenantBillingRepository();

      const dto: VerifyCheckoutPaymentDto = { razorpayOrderId: 'order_x', razorpayPaymentId: 'pay_x', razorpaySignature: 'sig' };
      const service = createService(createFakeRequest(), planRepo, invoiceRepo, tenantRepo);
      await expect(service.verifyPayment(dto)).rejects.toThrow(NotFoundError);
    });

    it("throws ForbiddenError when the invoice belongs to a different tenant", async () => {
      const planRepo = createMockPlanRepository();
      const invoiceRepo = createMockInvoiceRepository();
      invoiceRepo.findByRazorpayOrderId.mockResolvedValue(createMockInvoice({ tenantId: OTHER_TENANT_ID }));
      const tenantRepo = createMockTenantBillingRepository();

      const dto: VerifyCheckoutPaymentDto = { razorpayOrderId: 'order_fake123', razorpayPaymentId: 'pay_x', razorpaySignature: 'sig' };
      const service = createService(createFakeRequest(TENANT_ID), planRepo, invoiceRepo, tenantRepo);
      await expect(service.verifyPayment(dto)).rejects.toThrow(ForbiddenError);
    });

    it('is idempotent: returns the current subscription without re-verifying an already-PAID invoice, and does NOT re-notify (duplicate/replay prevention)', async () => {
      const planRepo = createMockPlanRepository();
      planRepo.findByCode.mockResolvedValue(createMockPlan());
      const invoiceRepo = createMockInvoiceRepository();
      invoiceRepo.findByRazorpayOrderId.mockResolvedValue(createMockInvoice({ status: PlatformInvoiceStatus.PAID }));
      const tenantRepo = createMockTenantBillingRepository();
      tenantRepo.findById.mockResolvedValue(createMockTenant());

      const dto: VerifyCheckoutPaymentDto = { razorpayOrderId: 'order_fake123', razorpayPaymentId: 'pay_x', razorpaySignature: 'totally-wrong' };
      const notificationDispatchService = createMockNotificationDispatchService();
      const service = createService(createFakeRequest(), planRepo, invoiceRepo, tenantRepo, createMockUserRepository(), notificationDispatchService);
      const result = await service.verifyPayment(dto);

      expect(invoiceRepo.markPaid).not.toHaveBeenCalled();
      expect(result.subscriptionStatus).toBe(SubscriptionStatus.ACTIVE);
      expect(notificationDispatchService.send).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError when the signature does not match', async () => {
      const planRepo = createMockPlanRepository();
      const invoiceRepo = createMockInvoiceRepository();
      invoiceRepo.findByRazorpayOrderId.mockResolvedValue(createMockInvoice());
      const tenantRepo = createMockTenantBillingRepository();

      const dto: VerifyCheckoutPaymentDto = { razorpayOrderId: 'order_fake123', razorpayPaymentId: 'pay_fake456', razorpaySignature: 'not-the-real-signature' };
      const service = createService(createFakeRequest(), planRepo, invoiceRepo, tenantRepo);
      await expect(service.verifyPayment(dto)).rejects.toThrow(ForbiddenError);
      expect(invoiceRepo.markPaid).not.toHaveBeenCalled();
    });

    it('marks the invoice PAID, applies the plan to the tenant, and notifies the tenant owner when the signature is valid', async () => {
      const planRepo = createMockPlanRepository();
      planRepo.findByCode.mockResolvedValue(createMockPlan());
      const invoiceRepo = createMockInvoiceRepository();
      const invoice = createMockInvoice();
      invoiceRepo.findByRazorpayOrderId.mockResolvedValue(invoice);
      invoiceRepo.markPaid.mockResolvedValue({ ...invoice, status: PlatformInvoiceStatus.PAID });
      const tenantRepo = createMockTenantBillingRepository();
      tenantRepo.findById.mockResolvedValue(createMockTenant());
      tenantRepo.applyPlan.mockResolvedValue(createMockTenant());
      const userRepo = createMockUserRepository();
      userRepo.findOwnerByTenant.mockResolvedValue({ id: 'owner-id' });

      const validSignature = signaturePair('order_fake123', 'pay_fake456');
      const dto: VerifyCheckoutPaymentDto = { razorpayOrderId: 'order_fake123', razorpayPaymentId: 'pay_fake456', razorpaySignature: validSignature };
      const notificationDispatchService = createMockNotificationDispatchService();
      const service = createService(createFakeRequest(), planRepo, invoiceRepo, tenantRepo, userRepo, notificationDispatchService);
      await service.verifyPayment(dto);

      expect(invoiceRepo.markPaid).toHaveBeenCalledWith(
        invoice.id,
        expect.objectContaining({ razorpayPaymentId: 'pay_fake456', razorpaySignature: validSignature }),
      );
      expect(tenantRepo.applyPlan).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({ planCode: invoice.plan.code, subscriptionStatus: SubscriptionStatus.ACTIVE }),
      );
      expect(notificationDispatchService.send).toHaveBeenCalledWith({
        tenantId: invoice.tenantId,
        userId: 'owner-id',
        title: 'Subscription activated',
        message: expect.stringContaining(invoice.plan.name),
        channels: [NotificationChannel.IN_APP],
      });
    });
  });

  describe('handleWebhook', () => {
    it('no-ops when RAZORPAY_WEBHOOK_SECRET is not configured', async () => {
      const planRepo = createMockPlanRepository();
      const invoiceRepo = createMockInvoiceRepository();
      const tenantRepo = createMockTenantBillingRepository();

      const service = createService(createFakeRequest(), planRepo, invoiceRepo, tenantRepo);
      await expect(service.handleWebhook(Buffer.from('{}'), 'sig')).resolves.toBeUndefined();
      expect(invoiceRepo.findByRazorpayOrderId).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError when configured but the signature is invalid', async () => {
      (razorpayConfig as { webhookSecret: string | undefined }).webhookSecret = 'whsec_fake';
      (Razorpay.validateWebhookSignature as jest.Mock).mockReturnValue(false);

      const planRepo = createMockPlanRepository();
      const invoiceRepo = createMockInvoiceRepository();
      const tenantRepo = createMockTenantBillingRepository();

      const service = createService(createFakeRequest(), planRepo, invoiceRepo, tenantRepo);
      await expect(service.handleWebhook(Buffer.from('{}'), 'bad-sig')).rejects.toThrow(ForbiddenError);
    });

    it('finalizes a matching PENDING invoice when the signature is valid', async () => {
      (razorpayConfig as { webhookSecret: string | undefined }).webhookSecret = 'whsec_fake';
      (Razorpay.validateWebhookSignature as jest.Mock).mockReturnValue(true);

      const planRepo = createMockPlanRepository();
      const invoiceRepo = createMockInvoiceRepository();
      const invoice = createMockInvoice();
      invoiceRepo.findByRazorpayOrderId.mockResolvedValue(invoice);
      invoiceRepo.markPaid.mockResolvedValue({ ...invoice, status: PlatformInvoiceStatus.PAID });
      const tenantRepo = createMockTenantBillingRepository();
      tenantRepo.applyPlan.mockResolvedValue(createMockTenant());

      const body = JSON.stringify({
        event: 'payment.captured',
        payload: { payment: { entity: { id: 'pay_webhook1', order_id: 'order_fake123' } } },
      });

      const service = createService(createFakeRequest(), planRepo, invoiceRepo, tenantRepo);
      await service.handleWebhook(Buffer.from(body), 'valid-sig');

      expect(invoiceRepo.markPaid).toHaveBeenCalledWith(invoice.id, expect.objectContaining({ razorpayPaymentId: 'pay_webhook1' }));
      expect(tenantRepo.applyPlan).toHaveBeenCalled();
    });

    it('a webhook replay for an already-PAID invoice is a no-op and does NOT re-notify (webhook-replay prevention)', async () => {
      (razorpayConfig as { webhookSecret: string | undefined }).webhookSecret = 'whsec_fake';
      (Razorpay.validateWebhookSignature as jest.Mock).mockReturnValue(true);

      const planRepo = createMockPlanRepository();
      const invoiceRepo = createMockInvoiceRepository();
      invoiceRepo.findByRazorpayOrderId.mockResolvedValue(createMockInvoice({ status: PlatformInvoiceStatus.PAID }));
      const tenantRepo = createMockTenantBillingRepository();

      const body = JSON.stringify({
        event: 'payment.captured',
        payload: { payment: { entity: { id: 'pay_webhook1', order_id: 'order_fake123' } } },
      });

      const notificationDispatchService = createMockNotificationDispatchService();
      const service = createService(createFakeRequest(), planRepo, invoiceRepo, tenantRepo, createMockUserRepository(), notificationDispatchService);
      await service.handleWebhook(Buffer.from(body), 'valid-sig');

      expect(invoiceRepo.markPaid).not.toHaveBeenCalled();
      expect(tenantRepo.applyPlan).not.toHaveBeenCalled();
      expect(notificationDispatchService.send).not.toHaveBeenCalled();
    });

    it('ignores a valid webhook for an unknown order id', async () => {
      (razorpayConfig as { webhookSecret: string | undefined }).webhookSecret = 'whsec_fake';
      (Razorpay.validateWebhookSignature as jest.Mock).mockReturnValue(true);

      const planRepo = createMockPlanRepository();
      const invoiceRepo = createMockInvoiceRepository();
      invoiceRepo.findByRazorpayOrderId.mockResolvedValue(null);
      const tenantRepo = createMockTenantBillingRepository();

      const body = JSON.stringify({
        event: 'payment.captured',
        payload: { payment: { entity: { id: 'pay_x', order_id: 'order_unknown' } } },
      });

      const service = createService(createFakeRequest(), planRepo, invoiceRepo, tenantRepo);
      await expect(service.handleWebhook(Buffer.from(body), 'valid-sig')).resolves.toBeUndefined();
    });
  });
});
