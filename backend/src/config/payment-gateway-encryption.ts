import { env } from './environment';

/**
 * Encryption key for `FirmPaymentGatewaySettings`' secrets — mirrors
 * `config/razorpay.ts`'s `isConfigured` co-location pattern. Deliberately a
 * separate config object from `razorpayConfig`: that one holds the
 * PLATFORM's own Razorpay credentials (SaaS subscription billing), this one
 * only ever encrypts/decrypts a TENANT's own gateway credentials
 * (`modules/client-billing`'s payment-gateway providers).
 */
export const paymentGatewayEncryptionConfig = {
  key: env.PAYMENT_GATEWAY_ENCRYPTION_KEY,
  isConfigured: Boolean(env.PAYMENT_GATEWAY_ENCRYPTION_KEY),
} as const;
