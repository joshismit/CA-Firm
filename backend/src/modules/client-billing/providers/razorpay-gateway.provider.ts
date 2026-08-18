import Razorpay from 'razorpay';
import { PaymentGatewayProviderType } from '@prisma/client';
import { logger } from '@config/logger';
import { ServiceUnavailableError } from '@shared/errors';
import { ErrorCode } from '@shared/enums';
import {
  PaymentGatewayProvider,
  PaymentGatewayCapabilities,
  PaymentGatewayHealth,
  InitializePaymentInput,
  InitializePaymentResult,
  VerifyPaymentInput,
  VerifyPaymentResult,
  PaymentVerificationStatus,
  RefundInput,
  RefundResult,
} from './payment-gateway-provider.interface';

export interface RazorpayGatewayCredentials {
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
  isTestMode: boolean;
}

const LINK_STATUS_MAP: Record<string, PaymentVerificationStatus> = {
  paid: 'PAID',
  partially_paid: 'PARTIALLY_PAID',
  created: 'PENDING',
  expired: 'EXPIRED',
  cancelled: 'CANCELLED',
};

/**
 * Firm-owned Razorpay integration (client -> firm payment collection, via
 * Razorpay Payment Links). Deliberately builds its OWN `Razorpay` client
 * from THIS firm's decrypted credentials — never `config/razorpay.ts`'s
 * shared singleton, which is the PLATFORM's own account for SaaS
 * subscription billing (`modules/billing`). Signature verification reuses
 * the same static `Razorpay.validateWebhookSignature` helper
 * `modules/billing/service/billing.service.ts` calls, but keyed on this
 * firm's own `webhookSecret`, never `RAZORPAY_WEBHOOK_SECRET`.
 */
export class RazorpayGatewayProvider implements PaymentGatewayProvider {
  readonly type = PaymentGatewayProviderType.RAZORPAY;
  readonly isConfigured: boolean;
  /** `null` when unconfigured — the Razorpay SDK itself throws synchronously if constructed with an empty `key_id` (unlike `config/razorpay.ts`'s platform singleton, which always has a real key_id in every real deployment), so the client is only ever built once `isConfigured` is confirmed true. */
  private readonly client: Razorpay | null;

  constructor(private readonly credentials: RazorpayGatewayCredentials) {
    this.isConfigured = Boolean(credentials.keyId && credentials.keySecret);
    this.client = this.isConfigured ? new Razorpay({ key_id: credentials.keyId, key_secret: credentials.keySecret }) : null;
  }

  async initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const client = this.assertConfigured();

    const link = await client.paymentLink.create({
      amount: input.amountInPaise,
      currency: input.currency,
      description: input.description,
      reference_id: input.referenceId,
      expire_by: input.expiresAt ? Math.floor(input.expiresAt.getTime() / 1000) : undefined,
      customer: {
        name: input.customerName,
        email: input.customerEmail,
        contact: input.customerContact,
      },
      notify: { email: Boolean(input.customerEmail), sms: Boolean(input.customerContact) },
    });

    return {
      providerPaymentId: link.id,
      paymentUrl: link.short_url,
      status: link.status,
      expiresAt: link.expire_by ? new Date(link.expire_by * 1000) : undefined,
      raw: link as unknown as Record<string, unknown>,
    };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    const client = this.assertConfigured();

    const link = await client.paymentLink.fetch(input.providerPaymentId);

    return {
      verified: link.status === 'paid',
      status: LINK_STATUS_MAP[link.status] ?? 'PENDING',
      amountPaidInPaise: link.amount_paid,
      providerPaymentReferenceId: link.payments?.payment_id,
      raw: link as unknown as Record<string, unknown>,
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    if (!this.isConfigured || !this.client) {
      return { success: false, error: 'No payment gateway is configured for this firm yet' };
    }

    try {
      const refund = await this.client.payments.refund(input.providerPaymentReferenceId, {
        amount: input.amountInPaise,
        notes: input.reason ? { reason: input.reason } : undefined,
      });
      return { success: true, providerRefundId: refund.id };
    } catch (err) {
      logger.error({ err }, 'Razorpay client-payment refund failed');
      return { success: false, error: err instanceof Error ? err.message : 'Unknown refund error' };
    }
  }

  getCapabilities(): PaymentGatewayCapabilities {
    return { supportsPaymentLinks: true, supportsRefunds: true, supportsPartialPayments: true, supportedCurrencies: ['INR'] };
  }

  /** Genuine network probe — lists at most one Payment Link to confirm these credentials actually authenticate, mirroring Email's SMTP `verify()` precedent noted on `NotificationProvider.health()`. */
  async healthCheck(): Promise<PaymentGatewayHealth> {
    if (!this.isConfigured || !this.client) {
      return { status: 'unconfigured', checkedAt: new Date().toISOString() };
    }

    const start = Date.now();
    try {
      await this.client.paymentLink.all({ count: 1 });
      return { status: 'up', checkedAt: new Date().toISOString(), latencyMs: Date.now() - start };
    } catch (err) {
      return {
        status: 'down',
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - start,
        detail: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    if (!this.credentials.webhookSecret) return false;
    return Razorpay.validateWebhookSignature(rawBody.toString(), signature, this.credentials.webhookSecret);
  }

  private assertConfigured(): Razorpay {
    if (!this.isConfigured || !this.client) {
      throw new ServiceUnavailableError('No payment gateway is configured for this firm yet', ErrorCode.DEPENDENCY_UNAVAILABLE);
    }
    return this.client;
  }
}
