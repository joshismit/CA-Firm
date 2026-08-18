import { PaymentGatewayProviderType } from '@prisma/client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Payment Gateway Provider Interface (PRD §12 — firm-owned client payment
 * collection, "provider-based payment gateway architecture for firms")
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Mirrors `modules/notifications/providers/notification-provider.interface.ts`'s
 * shape exactly (`isConfigured`, `getCapabilities()`, a `health`-style check),
 * with one structural difference: a `NotificationProvider` is a fixed
 * env-configured singleton (one Email/SMS/WhatsApp account for the whole
 * platform), but a `PaymentGatewayProvider` is instantiated per-tenant, from
 * THAT firm's own decrypted `FirmPaymentGatewaySettings` credentials — see
 * `providers/index.ts`'s `createPaymentGatewayProvider()` factory. No
 * business logic (`PaymentLinkService`, `PaymentGatewayWebhookService`,
 * `PaymentGatewaySettingsService`) ever imports a concrete provider or the
 * `razorpay` SDK directly — everything goes through this interface, so
 * adding Paytm/Cashfree/Stripe/PhonePe later is a new class + one switch
 * case in the factory, not a change to any of those services.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface InitializePaymentInput {
  /** Smallest currency unit (paise for INR) — same convention as `modules/billing`'s `amountInPaise`. */
  amountInPaise: number;
  currency: string;
  /** Caller-supplied idempotency/reconciliation reference — the invoice number. */
  referenceId: string;
  description?: string;
  customerName?: string;
  customerEmail?: string;
  customerContact?: string;
  expiresAt?: Date;
}

export interface InitializePaymentResult {
  /** The provider's own identifier for this payment link/order (e.g. Razorpay's `plink_...`). */
  providerPaymentId: string;
  paymentUrl: string;
  status: string;
  expiresAt?: Date;
  /** Provider's raw response — stored as-is in `PaymentGatewayLink.providerMetadata`, never parsed by callers. */
  raw: Record<string, unknown>;
}

export interface VerifyPaymentInput {
  providerPaymentId: string;
}

export type PaymentVerificationStatus = 'PAID' | 'PARTIALLY_PAID' | 'PENDING' | 'FAILED' | 'EXPIRED' | 'CANCELLED';

export interface VerifyPaymentResult {
  verified: boolean;
  status: PaymentVerificationStatus;
  amountPaidInPaise?: number;
  /** The provider's own payment (not payment-link) id, when a real payment has landed — e.g. Razorpay's `pay_...`. */
  providerPaymentReferenceId?: string;
  raw?: Record<string, unknown>;
}

export interface RefundInput {
  /** The provider's own payment id (not the payment-link id) to refund. */
  providerPaymentReferenceId: string;
  /** Omit for a full refund. */
  amountInPaise?: number;
  reason?: string;
}

export interface RefundResult {
  success: boolean;
  providerRefundId?: string;
  /** Present only when `success` is false — never thrown, mirroring `NotificationSendResult.error`. */
  error?: string;
}

/** Every provider's fixed, non-network-dependent shape — does not vary by tenant/env, mirrors `NotificationProviderCapabilities`. */
export interface PaymentGatewayCapabilities {
  supportsPaymentLinks: boolean;
  supportsRefunds: boolean;
  supportsPartialPayments: boolean;
  supportedCurrencies: string[];
}

/** Backs `GET /billing/payment-gateway/settings/health`, mirrors `NotificationProviderHealth`. */
export interface PaymentGatewayHealth {
  status: 'up' | 'down' | 'unconfigured';
  checkedAt: string;
  latencyMs?: number;
  detail?: string;
}

export interface PaymentGatewayProvider {
  readonly type: PaymentGatewayProviderType;
  /** False when this tenant hasn't set the credentials this provider needs — every method below short-circuits rather than attempting a network call. */
  readonly isConfigured: boolean;
  initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult>;
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;
  refund(input: RefundInput): Promise<RefundResult>;
  getCapabilities(): PaymentGatewayCapabilities;
  healthCheck(): Promise<PaymentGatewayHealth>;
  /** Verifies a webhook payload's signature against this tenant's OWN webhook secret — never the platform's `RAZORPAY_WEBHOOK_SECRET`. */
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean;
}
