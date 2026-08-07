import { PaymentGatewayProviderType } from '@prisma/client';

/**
 * `keySecret`/`webhookSecret` are NEVER present here (PRD §12 "Never return
 * secrets through APIs") — only `hasKeySecret`/`hasWebhookSecret` booleans,
 * so the frontend can render "configured" vs. "not set" without ever
 * handling plaintext. `keyId` is returned as-is: for Razorpay it's the
 * public `key_id`, safe client-side by design (used in Razorpay's own
 * Checkout.js), unlike the secret pair.
 */
export interface PaymentGatewaySettingsResponseDto {
  enabled: boolean;
  provider: PaymentGatewayProviderType;
  keyId: string | null;
  hasKeySecret: boolean;
  hasWebhookSecret: boolean;
  isTestMode: boolean;
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentGatewayCapabilitiesResponseDto {
  provider: PaymentGatewayProviderType;
  supportsPaymentLinks: boolean;
  supportsRefunds: boolean;
  supportsPartialPayments: boolean;
  supportedCurrencies: string[];
}

export interface PaymentGatewayHealthResponseDto {
  provider: PaymentGatewayProviderType;
  status: 'up' | 'down' | 'unconfigured';
  checkedAt: string;
  latencyMs?: number;
  detail?: string;
}
