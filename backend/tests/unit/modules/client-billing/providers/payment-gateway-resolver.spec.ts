import { PaymentGatewayProviderType, FirmPaymentGatewaySettings } from '@prisma/client';
import { CryptoUtils } from '@shared/utils';
import { paymentGatewayEncryptionConfig } from '@config/payment-gateway-encryption';
import { resolvePaymentGatewayProvider, resolvePaymentGatewayProviderForTenant } from '@modules/client-billing/providers';
import { DisabledGatewayProvider } from '@modules/client-billing/providers/disabled-gateway.provider';
import { RazorpayGatewayProvider } from '@modules/client-billing/providers/razorpay-gateway.provider';
import { PaymentGatewaySettingsRepository } from '@modules/client-billing/repository/payment-gateway-settings.repository';

/**
 * `resolvePaymentGatewayProvider` — the factory every business-logic layer
 * (`PaymentGatewaySettingsService`, `PaymentLinkService`,
 * `PaymentGatewayWebhookService`) goes through instead of branching on
 * `PaymentGatewayProviderType` directly. Uses the REAL
 * `paymentGatewayEncryptionConfig` (backed by `.env`'s
 * `PAYMENT_GATEWAY_ENCRYPTION_KEY`, loaded by `tests/setup.ts`) rather than
 * mocking it — `it("falls back to Disabled...")` below is the one case that
 * needs the unconfigured branch, done via `jest.doMock` + dynamic import,
 * mirroring `tests/unit/modules/notifications/providers/sms.provider.spec.ts`.
 */
function baseSettings(overrides: Partial<FirmPaymentGatewaySettings> = {}): FirmPaymentGatewaySettings {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'settings-1',
    tenantId: 'tenant-1',
    enabled: true,
    provider: PaymentGatewayProviderType.RAZORPAY,
    keyId: 'rzp_test_key',
    encryptedKeySecret: CryptoUtils.encryptSecret('rzp_test_secret', paymentGatewayEncryptionConfig.key as string),
    encryptedWebhookSecret: CryptoUtils.encryptSecret('whsec_test', paymentGatewayEncryptionConfig.key as string),
    isTestMode: true,
    isActive: true,
    createdBy: null,
    updatedBy: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('resolvePaymentGatewayProvider', () => {
  it('returns DisabledGatewayProvider when there is no settings row at all', () => {
    expect(resolvePaymentGatewayProvider(null)).toBeInstanceOf(DisabledGatewayProvider);
  });

  it('returns DisabledGatewayProvider when the firm has not enabled the gateway', () => {
    const provider = resolvePaymentGatewayProvider(baseSettings({ enabled: false }));
    expect(provider).toBeInstanceOf(DisabledGatewayProvider);
  });

  it('returns DisabledGatewayProvider when the provider is explicitly DISABLED', () => {
    const provider = resolvePaymentGatewayProvider(baseSettings({ provider: PaymentGatewayProviderType.DISABLED }));
    expect(provider).toBeInstanceOf(DisabledGatewayProvider);
  });

  it('returns a configured RazorpayGatewayProvider, decrypting the stored secrets', () => {
    const provider = resolvePaymentGatewayProvider(baseSettings());

    expect(provider).toBeInstanceOf(RazorpayGatewayProvider);
    expect(provider.isConfigured).toBe(true);
    expect(provider.type).toBe(PaymentGatewayProviderType.RAZORPAY);
  });

  it('returns DisabledGatewayProvider for RAZORPAY when no key secret has ever been saved', () => {
    const provider = resolvePaymentGatewayProvider(baseSettings({ encryptedKeySecret: null }));
    expect(provider).toBeInstanceOf(DisabledGatewayProvider);
  });

  it('falls back to DisabledGatewayProvider when PAYMENT_GATEWAY_ENCRYPTION_KEY is not configured, even for an otherwise-valid row', async () => {
    jest.resetModules();
    jest.doMock('@config/payment-gateway-encryption', () => ({ paymentGatewayEncryptionConfig: { key: undefined, isConfigured: false } }));

    const { resolvePaymentGatewayProvider: resolveWithoutKey } = await import('@modules/client-billing/providers');
    const { DisabledGatewayProvider: DisabledAfterRemock } = await import('@modules/client-billing/providers/disabled-gateway.provider');

    const provider = resolveWithoutKey(baseSettings());
    expect(provider).toBeInstanceOf(DisabledAfterRemock);

    jest.dontMock('@config/payment-gateway-encryption');
    jest.resetModules();
  });
});

describe('resolvePaymentGatewayProviderForTenant', () => {
  it('looks up settings via the repository and resolves the provider from them', async () => {
    const repository = { findByTenantId: jest.fn().mockResolvedValue(baseSettings()) } as unknown as PaymentGatewaySettingsRepository;

    const { settings, provider } = await resolvePaymentGatewayProviderForTenant('tenant-1', repository);

    expect(repository.findByTenantId).toHaveBeenCalledWith('tenant-1');
    expect(settings?.tenantId).toBe('tenant-1');
    expect(provider).toBeInstanceOf(RazorpayGatewayProvider);
  });
});
