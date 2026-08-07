import { PaymentGatewayLinkStatus, PaymentStatus, InvoiceStatus } from '@prisma/client';
import { prisma } from '@config/database';
import { logger } from '@config/logger';
import { ForbiddenError } from '@shared/errors';
import { PaymentGatewayLinkRepository } from '../repository/payment-gateway-link.repository';
import { PaymentGatewaySettingsRepository } from '../repository/payment-gateway-settings.repository';
import { InvoiceRepository } from '../repository/invoice.repository';
import { PaymentRepository } from '../repository/payment.repository';
import { resolvePaymentGatewayProvider } from '../providers';

interface RazorpayPaymentLinkWebhookPayload {
  event: string;
  payload: {
    payment_link?: { entity?: { id?: string } };
    payment?: { entity?: { id?: string } };
  };
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Payment Gateway Webhook Service (PRD §12 — "Create a provider webhook
 * pipeline. Do NOT interfere with existing Platform Razorpay webhooks. Firm
 * payment webhooks must be completely independent.")
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Deliberately a plain class, not a `BaseService` — a webhook request has no
 * authenticated `req.user`/`req.tenant` (see
 * `routes/payment-gateway-webhook.routes.ts`'s header comment), so there is
 * no tenant context to construct one from. The tenant is discovered from the
 * `PaymentGatewayLink` row itself (see
 * `PaymentGatewayLinkRepository.findByProviderPaymentId()`'s comment) and
 * every subsequent operation is scoped through it.
 *
 * Idempotent the same way `modules/billing/service/billing.service.ts`'s
 * `handleWebhook()` is: guarded on the link's own `status`, so a Razorpay
 * retry (or accidental replay) of an already-processed event is a safe
 * no-op rather than a duplicate `Payment` row.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class PaymentGatewayWebhookService {
  constructor(
    private readonly linkRepository: PaymentGatewayLinkRepository = new PaymentGatewayLinkRepository(prisma),
    private readonly settingsRepository: PaymentGatewaySettingsRepository = new PaymentGatewaySettingsRepository(prisma),
    private readonly invoiceRepository: InvoiceRepository = new InvoiceRepository(prisma),
    private readonly paymentRepository: PaymentRepository = new PaymentRepository(prisma),
  ) {}

  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined): Promise<void> {
    if (!rawBody || !signature) {
      throw new ForbiddenError('Missing webhook signature');
    }

    let payload: RazorpayPaymentLinkWebhookPayload;
    try {
      payload = JSON.parse(rawBody.toString()) as RazorpayPaymentLinkWebhookPayload;
    } catch {
      throw new ForbiddenError('Malformed webhook payload');
    }

    const providerPaymentId = payload.payload?.payment_link?.entity?.id;
    if (!providerPaymentId) return; // Not a Payment Link event we track — ignore rather than error.

    const link = await this.linkRepository.findByProviderPaymentId(providerPaymentId);
    if (!link) {
      logger.warn({ providerPaymentId }, 'Received a client-payment webhook for an unknown payment link — ignoring');
      return;
    }

    const settings = await this.settingsRepository.findByTenantId(link.tenantId);
    const gatewayProvider = resolvePaymentGatewayProvider(settings);

    if (!gatewayProvider.verifyWebhookSignature(rawBody, signature)) {
      throw new ForbiddenError('Invalid webhook signature');
    }

    if (link.status === PaymentGatewayLinkStatus.PAID) return; // Already processed — idempotent no-op.
    if (payload.event !== 'payment_link.paid') return;

    const providerPaymentReferenceId = payload.payload.payment?.entity?.id ?? providerPaymentId;

    await prisma.$transaction(async (tx) => {
      const payment = await this.paymentRepository.create(
        {
          paymentNumber: `PAY-GW-${providerPaymentId}`,
          invoiceId: link.invoiceId,
          amount: link.amountInPaise / 100,
          method: 'GATEWAY',
          reference: providerPaymentReferenceId,
          paidDate: new Date(),
          status: PaymentStatus.COMPLETED,
        },
        { tenantId: link.tenantId, tx },
      );

      await this.linkRepository.update(
        link.id,
        { status: PaymentGatewayLinkStatus.PAID, paymentId: payment.id },
        { tenantId: link.tenantId, tx },
      );

      await this.invoiceRepository.update(link.invoiceId, { status: InvoiceStatus.PAID }, { tenantId: link.tenantId, tx });
    });

    logger.info({ tenantId: link.tenantId, invoiceId: link.invoiceId }, 'Client payment confirmed via gateway webhook');
  }
}
