import { PaymentGatewayProviderType } from '@prisma/client';
import { ServiceUnavailableError } from '@shared/errors';
import { DisabledGatewayProvider } from '@modules/client-billing/providers/disabled-gateway.provider';

describe('DisabledGatewayProvider', () => {
  const provider = new DisabledGatewayProvider();

  it('reports its type and is never configured', () => {
    expect(provider.type).toBe(PaymentGatewayProviderType.DISABLED);
    expect(provider.isConfigured).toBe(false);
  });

  it('initializePayment() throws a clear 503 rather than attempting anything', async () => {
    await expect(provider.initializePayment()).rejects.toThrow(ServiceUnavailableError);
  });

  it('verifyPayment() reports FAILED/unverified without throwing', async () => {
    await expect(provider.verifyPayment()).resolves.toEqual({ verified: false, status: 'FAILED' });
  });

  it('refund() reports failure without throwing', async () => {
    await expect(provider.refund()).resolves.toEqual({
      success: false,
      error: 'No payment gateway is configured for this firm yet',
    });
  });

  it('getCapabilities() reports every capability as unsupported', () => {
    expect(provider.getCapabilities()).toEqual({
      supportsPaymentLinks: false,
      supportsRefunds: false,
      supportsPartialPayments: false,
      supportedCurrencies: [],
    });
  });

  it('healthCheck() reports unconfigured', async () => {
    const health = await provider.healthCheck();
    expect(health.status).toBe('unconfigured');
  });

  it('verifyWebhookSignature() always returns false', () => {
    expect(provider.verifyWebhookSignature(Buffer.from('{}'), 'any-signature')).toBe(false);
  });
});
