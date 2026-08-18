import { FirmPaymentGatewaySettings, PaymentGatewayProviderType } from '@prisma/client';
import { prisma } from '@config/database';
import { paymentGatewayEncryptionConfig } from '@config/payment-gateway-encryption';
import { CryptoUtils } from '@shared/utils';
import { PaymentGatewaySettingsRepository } from '../repository/payment-gateway-settings.repository';
import { PaymentGatewayProvider } from './payment-gateway-provider.interface';
import { DisabledGatewayProvider } from './disabled-gateway.provider';
import { RazorpayGatewayProvider } from './razorpay-gateway.provider';

export * from './payment-gateway-provider.interface';
export { DisabledGatewayProvider } from './disabled-gateway.provider';
export { RazorpayGatewayProvider } from './razorpay-gateway.provider';

/**
 * Resolves the concrete provider for a firm's settings row. Every new
 * provider (Paytm/Cashfree/Stripe/PhonePe, ...) is one new `case` here and
 * one new implementation class — no other file in this module ever branches
 * on `PaymentGatewayProviderType` directly.
 *
 * Returns `DisabledGatewayProvider` (never `null`) whenever the firm hasn't
 * enabled collection, has no row yet, or picked a provider whose secret
 * can't currently be decrypted (`PAYMENT_GATEWAY_ENCRYPTION_KEY` unset) —
 * mirrors `NotificationProvider`'s "isConfigured guards every method" shape,
 * so callers never null-check a provider, they just check `isConfigured`.
 */
export function resolvePaymentGatewayProvider(settings: FirmPaymentGatewaySettings | null): PaymentGatewayProvider {
  if (!settings || !settings.enabled || settings.provider === PaymentGatewayProviderType.DISABLED) {
    return new DisabledGatewayProvider();
  }

  switch (settings.provider) {
    case PaymentGatewayProviderType.RAZORPAY: {
      if (!paymentGatewayEncryptionConfig.isConfigured || !settings.encryptedKeySecret) {
        return new DisabledGatewayProvider();
      }
      const key = paymentGatewayEncryptionConfig.key as string;
      return new RazorpayGatewayProvider({
        keyId: settings.keyId ?? '',
        keySecret: CryptoUtils.decryptSecret(settings.encryptedKeySecret, key),
        webhookSecret: settings.encryptedWebhookSecret ? CryptoUtils.decryptSecret(settings.encryptedWebhookSecret, key) : undefined,
        isTestMode: settings.isTestMode,
      });
    }
    default:
      return new DisabledGatewayProvider();
  }
}

/**
 * Convenience wrapper over `resolvePaymentGatewayProvider()` for the common
 * "look up this tenant's settings, then resolve" call sequence
 * (`PaymentGatewaySettingsService`, `PaymentLinkService`). Takes an optional
 * repository purely for test injection — production call sites all use the
 * default.
 */
export async function resolvePaymentGatewayProviderForTenant(
  tenantId: string,
  repository: PaymentGatewaySettingsRepository = new PaymentGatewaySettingsRepository(prisma),
): Promise<{ settings: FirmPaymentGatewaySettings | null; provider: PaymentGatewayProvider }> {
  const settings = await repository.findByTenantId(tenantId);
  return { settings, provider: resolvePaymentGatewayProvider(settings) };
}
