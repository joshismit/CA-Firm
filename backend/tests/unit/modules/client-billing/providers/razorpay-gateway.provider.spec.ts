import { PaymentGatewayProviderType } from '@prisma/client';
import { ServiceUnavailableError } from '@shared/errors';

/**
 * RazorpayGatewayProvider — Unit Tests. The `razorpay` SDK itself is mocked
 * (never a real network call) — `paymentLink.create/fetch/all` and
 * `payments.refund` are jest mocks on the constructed instance,
 * `validateWebhookSignature` is a static mock, mirroring how
 * `tests/unit/modules/notifications/providers/sms.provider.spec.ts` mocks
 * `global.fetch` rather than hitting a real vendor.
 */
const paymentLinkCreate = jest.fn();
const paymentLinkFetch = jest.fn();
const paymentLinkAll = jest.fn();
const paymentsRefund = jest.fn();
const validateWebhookSignature = jest.fn();

jest.mock('razorpay', () => {
  const MockRazorpay = jest.fn().mockImplementation(() => ({
    paymentLink: { create: paymentLinkCreate, fetch: paymentLinkFetch, all: paymentLinkAll },
    payments: { refund: paymentsRefund },
  }));
  (MockRazorpay as unknown as { validateWebhookSignature: jest.Mock }).validateWebhookSignature = validateWebhookSignature;
  return { __esModule: true, default: MockRazorpay };
});

import { RazorpayGatewayProvider } from '@modules/client-billing/providers/razorpay-gateway.provider';

describe('RazorpayGatewayProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createProvider(overrides: Partial<{ keyId: string; keySecret: string; webhookSecret: string; isTestMode: boolean }> = {}) {
    return new RazorpayGatewayProvider({
      keyId: 'rzp_test_key',
      keySecret: 'test_secret',
      webhookSecret: 'whsec_test',
      isTestMode: true,
      ...overrides,
    });
  }

  it('reports its type and isConfigured based on credentials', () => {
    expect(createProvider().type).toBe(PaymentGatewayProviderType.RAZORPAY);
    expect(createProvider().isConfigured).toBe(true);
    expect(createProvider({ keySecret: '' }).isConfigured).toBe(false);
  });

  describe('initializePayment', () => {
    it('throws a 503 when not configured, without calling the SDK', async () => {
      const provider = createProvider({ keySecret: '' });
      await expect(
        provider.initializePayment({ amountInPaise: 10000, currency: 'INR', referenceId: 'INV-001' }),
      ).rejects.toThrow(ServiceUnavailableError);
      expect(paymentLinkCreate).not.toHaveBeenCalled();
    });

    it('creates a Razorpay Payment Link and maps the response', async () => {
      paymentLinkCreate.mockResolvedValue({
        id: 'plink_123',
        short_url: 'https://rzp.io/i/abc123',
        status: 'created',
        expire_by: 1893456000,
      });

      const provider = createProvider();
      const result = await provider.initializePayment({
        amountInPaise: 50000,
        currency: 'INR',
        referenceId: 'INV-042',
        description: 'Invoice INV-042',
        customerEmail: 'client@example.test',
      });

      expect(paymentLinkCreate).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 50000, currency: 'INR', reference_id: 'INV-042' }),
      );
      expect(result).toEqual({
        providerPaymentId: 'plink_123',
        paymentUrl: 'https://rzp.io/i/abc123',
        status: 'created',
        expiresAt: new Date(1893456000 * 1000),
        raw: expect.objectContaining({ id: 'plink_123' }),
      });
    });
  });

  describe('verifyPayment', () => {
    it('reports PAID/verified once the link status is paid', async () => {
      paymentLinkFetch.mockResolvedValue({
        id: 'plink_123',
        status: 'paid',
        amount_paid: 50000,
        payments: { payment_id: 'pay_abc' },
      });

      const provider = createProvider();
      const result = await provider.verifyPayment({ providerPaymentId: 'plink_123' });

      expect(result).toEqual({
        verified: true,
        status: 'PAID',
        amountPaidInPaise: 50000,
        providerPaymentReferenceId: 'pay_abc',
        raw: expect.objectContaining({ status: 'paid' }),
      });
    });

    it('reports PENDING/unverified while the link is still open', async () => {
      paymentLinkFetch.mockResolvedValue({ id: 'plink_123', status: 'created', amount_paid: 0, payments: null });

      const provider = createProvider();
      const result = await provider.verifyPayment({ providerPaymentId: 'plink_123' });

      expect(result.verified).toBe(false);
      expect(result.status).toBe('PENDING');
    });
  });

  describe('refund', () => {
    it('returns success:false without calling the SDK when unconfigured', async () => {
      const provider = createProvider({ keySecret: '' });
      const result = await provider.refund({ providerPaymentReferenceId: 'pay_abc' });

      expect(result).toEqual({ success: false, error: 'No payment gateway is configured for this firm yet' });
      expect(paymentsRefund).not.toHaveBeenCalled();
    });

    it('issues a refund and returns the provider refund ID', async () => {
      paymentsRefund.mockResolvedValue({ id: 'rfnd_123' });

      const provider = createProvider();
      const result = await provider.refund({ providerPaymentReferenceId: 'pay_abc', amountInPaise: 20000 });

      expect(paymentsRefund).toHaveBeenCalledWith('pay_abc', expect.objectContaining({ amount: 20000 }));
      expect(result).toEqual({ success: true, providerRefundId: 'rfnd_123' });
    });

    it('returns success:false (never throws) when the SDK call rejects', async () => {
      paymentsRefund.mockRejectedValue(new Error('network error'));

      const provider = createProvider();
      const result = await provider.refund({ providerPaymentReferenceId: 'pay_abc' });

      expect(result).toEqual({ success: false, error: 'network error' });
    });
  });

  describe('getCapabilities', () => {
    it('reports payment links, refunds, and partial payments as supported', () => {
      expect(createProvider().getCapabilities()).toEqual({
        supportsPaymentLinks: true,
        supportsRefunds: true,
        supportsPartialPayments: true,
        supportedCurrencies: ['INR'],
      });
    });
  });

  describe('healthCheck', () => {
    it('reports unconfigured without calling the SDK when credentials are missing', async () => {
      const provider = createProvider({ keySecret: '' });
      const health = await provider.healthCheck();

      expect(health.status).toBe('unconfigured');
      expect(paymentLinkAll).not.toHaveBeenCalled();
    });

    it('reports "up" when a live probe against the account succeeds', async () => {
      paymentLinkAll.mockResolvedValue({ payment_links: [] });
      const health = await createProvider().healthCheck();

      expect(health.status).toBe('up');
      expect(typeof health.latencyMs).toBe('number');
    });

    it('reports "down" with a detail message when the probe fails', async () => {
      paymentLinkAll.mockRejectedValue(new Error('invalid credentials'));
      const health = await createProvider().healthCheck();

      expect(health.status).toBe('down');
      expect(health.detail).toBe('invalid credentials');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('returns false when no webhook secret is configured for this firm', () => {
      const provider = createProvider({ webhookSecret: undefined });
      expect(provider.verifyWebhookSignature(Buffer.from('{}'), 'sig')).toBe(false);
      expect(validateWebhookSignature).not.toHaveBeenCalled();
    });

    it("delegates to Razorpay's own static validator with this firm's own webhook secret", () => {
      validateWebhookSignature.mockReturnValue(true);
      const provider = createProvider({ webhookSecret: 'firm-own-secret' });

      const result = provider.verifyWebhookSignature(Buffer.from('{"event":"payment_link.paid"}'), 'sig-value');

      expect(validateWebhookSignature).toHaveBeenCalledWith('{"event":"payment_link.paid"}', 'sig-value', 'firm-own-secret');
      expect(result).toBe(true);
    });
  });
});
