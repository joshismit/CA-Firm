import { PaymentGatewayLink, PaymentGatewayLinkStatus, PaymentGatewayProviderType, FirmPaymentGatewaySettings } from '@prisma/client';

const transactionMock = jest.fn((cb: (tx: unknown) => unknown) => cb({}));
jest.mock('@config/database', () => ({ prisma: { $transaction: (cb: (tx: unknown) => unknown) => transactionMock(cb) } }));
jest.mock('@config/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const resolvePaymentGatewayProviderMock = jest.fn();
jest.mock('@modules/client-billing/providers', () => ({
  resolvePaymentGatewayProvider: (...args: unknown[]) => resolvePaymentGatewayProviderMock(...args),
}));

import { ForbiddenError } from '@shared/errors';
import { PaymentGatewayWebhookService } from '@modules/client-billing/service/payment-gateway-webhook.service';
import { PaymentGatewayLinkRepository } from '@modules/client-billing/repository/payment-gateway-link.repository';
import { PaymentGatewaySettingsRepository } from '@modules/client-billing/repository/payment-gateway-settings.repository';
import { InvoiceRepository } from '@modules/client-billing/repository/invoice.repository';
import { PaymentRepository } from '@modules/client-billing/repository/payment.repository';

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const INVOICE_ID = 'invoice-22222222-2222-2222-2222-222222222222';
const LINK_ID = 'link-33333333-3333-3333-3333-333333333333';

function createMockLink(overrides: Partial<PaymentGatewayLink> = {}): PaymentGatewayLink {
  return {
    id: LINK_ID,
    tenantId: TENANT_ID,
    invoiceId: INVOICE_ID,
    provider: PaymentGatewayProviderType.RAZORPAY,
    providerPaymentId: 'plink_123',
    url: 'https://rzp.io/i/abc',
    amountInPaise: 150000,
    currency: 'INR',
    status: PaymentGatewayLinkStatus.CREATED,
    expiresAt: null,
    providerMetadata: null,
    paymentId: null,
    createdBy: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
    ...overrides,
  };
}

function createMockSettings(): FirmPaymentGatewaySettings {
  return {
    id: 'settings-1',
    tenantId: TENANT_ID,
    enabled: true,
    provider: PaymentGatewayProviderType.RAZORPAY,
    keyId: 'rzp_key',
    encryptedKeySecret: 'iv:tag:data',
    encryptedWebhookSecret: 'iv:tag:data2',
    isTestMode: true,
    isActive: true,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };
}

function paidWebhookBody(providerPaymentId = 'plink_123', paymentEntityId = 'pay_abc') {
  return Buffer.from(
    JSON.stringify({
      event: 'payment_link.paid',
      payload: {
        payment_link: { entity: { id: providerPaymentId } },
        payment: { entity: { id: paymentEntityId } },
      },
    }),
  );
}

describe('PaymentGatewayWebhookService', () => {
  function createService() {
    const linkRepository = { findByProviderPaymentId: jest.fn(), update: jest.fn() };
    const settingsRepository = { findByTenantId: jest.fn() };
    const invoiceRepository = { update: jest.fn() };
    const paymentRepository = { create: jest.fn() };

    const service = new PaymentGatewayWebhookService(
      linkRepository as unknown as PaymentGatewayLinkRepository,
      settingsRepository as unknown as PaymentGatewaySettingsRepository,
      invoiceRepository as unknown as InvoiceRepository,
      paymentRepository as unknown as PaymentRepository,
    );

    return { service, linkRepository, settingsRepository, invoiceRepository, paymentRepository };
  }

  beforeEach(() => {
    resolvePaymentGatewayProviderMock.mockReset();
    transactionMock.mockClear();
  });

  it('throws when rawBody or signature is missing', async () => {
    const { service } = createService();
    await expect(service.handleWebhook(undefined, 'sig')).rejects.toThrow(ForbiddenError);
    await expect(service.handleWebhook(Buffer.from('{}'), undefined)).rejects.toThrow(ForbiddenError);
  });

  it('throws on a malformed (non-JSON) payload', async () => {
    const { service } = createService();
    await expect(service.handleWebhook(Buffer.from('not-json'), 'sig')).rejects.toThrow(ForbiddenError);
  });

  it('silently ignores a payload with no payment_link entity (e.g. an unrelated event type)', async () => {
    const { service, linkRepository } = createService();
    const body = Buffer.from(JSON.stringify({ event: 'refund.processed', payload: {} }));

    await expect(service.handleWebhook(body, 'sig')).resolves.toBeUndefined();
    expect(linkRepository.findByProviderPaymentId).not.toHaveBeenCalled();
  });

  it('silently ignores a webhook for a payment link this tenant never created', async () => {
    const { service, linkRepository } = createService();
    linkRepository.findByProviderPaymentId.mockResolvedValue(null);

    await expect(service.handleWebhook(paidWebhookBody(), 'sig')).resolves.toBeUndefined();
  });

  it('throws ForbiddenError when the signature does not verify against the OWNING tenant\'s own webhook secret', async () => {
    const { service, linkRepository, settingsRepository } = createService();
    linkRepository.findByProviderPaymentId.mockResolvedValue(createMockLink());
    settingsRepository.findByTenantId.mockResolvedValue(createMockSettings());
    resolvePaymentGatewayProviderMock.mockReturnValue({ verifyWebhookSignature: jest.fn().mockReturnValue(false) });

    await expect(service.handleWebhook(paidWebhookBody(), 'bad-sig')).rejects.toThrow(ForbiddenError);
  });

  it('looks up the OWNING tenant settings (not the caller\'s) to resolve the provider — tenant isolation', async () => {
    const { service, linkRepository, settingsRepository, paymentRepository } = createService();
    const link = createMockLink({ tenantId: 'some-other-tenant-id' });
    linkRepository.findByProviderPaymentId.mockResolvedValue(link);
    settingsRepository.findByTenantId.mockResolvedValue(createMockSettings());
    resolvePaymentGatewayProviderMock.mockReturnValue({ verifyWebhookSignature: jest.fn().mockReturnValue(true) });
    paymentRepository.create.mockResolvedValue({ id: 'payment-1' });

    await service.handleWebhook(paidWebhookBody(), 'sig');

    expect(settingsRepository.findByTenantId).toHaveBeenCalledWith('some-other-tenant-id');
  });

  it('is idempotent: a webhook for an already-PAID link is a no-op, even with a valid signature', async () => {
    const { service, linkRepository, settingsRepository, paymentRepository } = createService();
    linkRepository.findByProviderPaymentId.mockResolvedValue(createMockLink({ status: PaymentGatewayLinkStatus.PAID }));
    settingsRepository.findByTenantId.mockResolvedValue(createMockSettings());
    resolvePaymentGatewayProviderMock.mockReturnValue({ verifyWebhookSignature: jest.fn().mockReturnValue(true) });

    await service.handleWebhook(paidWebhookBody(), 'sig');

    expect(paymentRepository.create).not.toHaveBeenCalled();
  });

  it('creates a Payment, marks the link PAID, and marks the invoice PAID on a valid, unseen payment_link.paid event', async () => {
    const { service, linkRepository, settingsRepository, invoiceRepository, paymentRepository } = createService();
    const link = createMockLink();
    linkRepository.findByProviderPaymentId.mockResolvedValue(link);
    settingsRepository.findByTenantId.mockResolvedValue(createMockSettings());
    resolvePaymentGatewayProviderMock.mockReturnValue({ verifyWebhookSignature: jest.fn().mockReturnValue(true) });
    paymentRepository.create.mockResolvedValue({ id: 'payment-1' });

    await service.handleWebhook(paidWebhookBody('plink_123', 'pay_abc'), 'sig');

    expect(paymentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceId: INVOICE_ID, amount: 1500, method: 'GATEWAY', reference: 'pay_abc', status: 'COMPLETED' }),
      expect.objectContaining({ tenantId: TENANT_ID }),
    );
    expect(linkRepository.update).toHaveBeenCalledWith(
      LINK_ID,
      { status: PaymentGatewayLinkStatus.PAID, paymentId: 'payment-1' },
      expect.objectContaining({ tenantId: TENANT_ID }),
    );
    expect(invoiceRepository.update).toHaveBeenCalledWith(INVOICE_ID, { status: 'PAID' }, expect.objectContaining({ tenantId: TENANT_ID }));
  });

  it('ignores a non-"paid" event for a known link (e.g. payment_link.partially_paid)', async () => {
    const { service, linkRepository, settingsRepository, paymentRepository } = createService();
    linkRepository.findByProviderPaymentId.mockResolvedValue(createMockLink());
    settingsRepository.findByTenantId.mockResolvedValue(createMockSettings());
    resolvePaymentGatewayProviderMock.mockReturnValue({ verifyWebhookSignature: jest.fn().mockReturnValue(true) });

    const body = Buffer.from(
      JSON.stringify({ event: 'payment_link.partially_paid', payload: { payment_link: { entity: { id: 'plink_123' } } } }),
    );
    await service.handleWebhook(body, 'sig');

    expect(paymentRepository.create).not.toHaveBeenCalled();
  });
});
