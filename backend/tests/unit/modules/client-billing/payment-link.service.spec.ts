import { Request } from 'express';
import { Invoice, InvoiceStatus, PaymentGatewayProviderType, PaymentGatewayLinkStatus, FirmPaymentGatewaySettings } from '@prisma/client';

jest.mock('@config/database', () => ({ prisma: {} }));

const resolvePaymentGatewayProviderMock = jest.fn();
jest.mock('@modules/client-billing/providers', () => ({
  resolvePaymentGatewayProvider: (...args: unknown[]) => resolvePaymentGatewayProviderMock(...args),
}));

import { UserRole } from '@shared/enums';
import { ConflictError, NotFoundError, ServiceUnavailableError } from '@shared/errors';
import { PaymentLinkService } from '@modules/client-billing/service/payment-link.service';
import { PaymentGatewayLinkRepository } from '@modules/client-billing/repository/payment-gateway-link.repository';
import { InvoiceRepository } from '@modules/client-billing/repository/invoice.repository';
import { PaymentGatewaySettingsRepository } from '@modules/client-billing/repository/payment-gateway-settings.repository';
import { AuditLogRecorder } from '@modules/audit';

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';
const INVOICE_ID = 'invoice-33333333-3333-3333-3333-333333333333';

function createFakeRequest(): Request {
  return {
    tenant: { id: TENANT_ID, slug: 'acme', name: 'Acme & Co', planCode: 'professional', isActive: true },
    user: { id: USER_ID, email: 'staff@acme.test', role: UserRole.TENANT_ADMIN, tenantId: TENANT_ID, permissions: [] },
    correlationId: 'test-correlation-id',
    ip: '127.0.0.1',
  } as unknown as Request;
}

function createMockInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: INVOICE_ID,
    tenantId: TENANT_ID,
    invoiceNumber: 'INV-001',
    clientId: null,
    businessId: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    amount: { toNumber: () => 1000 } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tax: { toNumber: () => 0 } as any,
    issuedDate: null,
    dueDate: null,
    status: InvoiceStatus.SENT,
    notes: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
    ...overrides,
  };
}

function createMockSettings(overrides: Partial<FirmPaymentGatewaySettings> = {}): FirmPaymentGatewaySettings {
  return {
    id: 'settings-1',
    tenantId: TENANT_ID,
    enabled: true,
    provider: PaymentGatewayProviderType.RAZORPAY,
    keyId: 'rzp_key',
    encryptedKeySecret: 'iv:tag:data',
    encryptedWebhookSecret: null,
    isTestMode: true,
    isActive: true,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function createConfiguredFakeProvider() {
  return {
    type: PaymentGatewayProviderType.RAZORPAY,
    isConfigured: true,
    initializePayment: jest.fn().mockResolvedValue({
      providerPaymentId: 'plink_123',
      paymentUrl: 'https://rzp.io/i/abc',
      status: 'created',
      expiresAt: new Date('2026-02-01'),
      raw: { id: 'plink_123' },
    }),
  };
}

describe('PaymentLinkService', () => {
  function createService() {
    const linkRepository = { create: jest.fn(), listByInvoice: jest.fn() };
    const invoiceRepository = { findById: jest.fn() };
    const settingsRepository = { findByTenantId: jest.fn() };
    const auditLogRecorder = { record: jest.fn().mockResolvedValue(undefined) };

    const service = new PaymentLinkService(
      createFakeRequest(),
      linkRepository as unknown as PaymentGatewayLinkRepository,
      invoiceRepository as unknown as InvoiceRepository,
      settingsRepository as unknown as PaymentGatewaySettingsRepository,
      auditLogRecorder as unknown as AuditLogRecorder,
    );

    return { service, linkRepository, invoiceRepository, settingsRepository, auditLogRecorder };
  }

  beforeEach(() => {
    resolvePaymentGatewayProviderMock.mockReset();
  });

  describe('generatePaymentLink', () => {
    it('throws NotFoundError when the invoice does not belong to this tenant', async () => {
      const { service, invoiceRepository } = createService();
      invoiceRepository.findById.mockResolvedValue(null);

      await expect(service.generatePaymentLink({ invoiceId: INVOICE_ID })).rejects.toThrow(NotFoundError);
    });

    it.each([InvoiceStatus.PAID, InvoiceStatus.VOID])('throws ConflictError for a(n) %s invoice', async (status) => {
      const { service, invoiceRepository } = createService();
      invoiceRepository.findById.mockResolvedValue(createMockInvoice({ status }));

      await expect(service.generatePaymentLink({ invoiceId: INVOICE_ID })).rejects.toThrow(ConflictError);
    });

    it('throws ServiceUnavailableError when the firm has no gateway enabled', async () => {
      const { service, invoiceRepository, settingsRepository } = createService();
      invoiceRepository.findById.mockResolvedValue(createMockInvoice());
      settingsRepository.findByTenantId.mockResolvedValue(null);
      resolvePaymentGatewayProviderMock.mockReturnValue({ isConfigured: false });

      await expect(service.generatePaymentLink({ invoiceId: INVOICE_ID })).rejects.toThrow(ServiceUnavailableError);
    });

    it('resolves the provider, initializes a payment, and persists the resulting link', async () => {
      const { service, invoiceRepository, settingsRepository, linkRepository, auditLogRecorder } = createService();
      const invoice = createMockInvoice();
      invoiceRepository.findById.mockResolvedValue(invoice);
      settingsRepository.findByTenantId.mockResolvedValue(createMockSettings());
      const fakeProvider = createConfiguredFakeProvider();
      resolvePaymentGatewayProviderMock.mockReturnValue(fakeProvider);

      const createdLink = {
        id: 'link-1',
        tenantId: TENANT_ID,
        invoiceId: INVOICE_ID,
        provider: PaymentGatewayProviderType.RAZORPAY,
        providerPaymentId: 'plink_123',
        url: 'https://rzp.io/i/abc',
        amountInPaise: 100000,
        currency: 'INR',
        status: PaymentGatewayLinkStatus.CREATED,
        expiresAt: new Date('2026-02-01'),
        providerMetadata: { id: 'plink_123' },
        paymentId: null,
        createdBy: USER_ID,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      };
      linkRepository.create.mockResolvedValue(createdLink);

      const result = await service.generatePaymentLink({ invoiceId: INVOICE_ID });

      expect(fakeProvider.initializePayment).toHaveBeenCalledWith(
        expect.objectContaining({ amountInPaise: 100000, currency: 'INR', referenceId: 'INV-001' }),
      );
      expect(linkRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ invoiceId: INVOICE_ID, providerPaymentId: 'plink_123', url: 'https://rzp.io/i/abc' }),
        { tenantId: TENANT_ID },
      );
      expect(result.providerPaymentId).toBe('plink_123');
      expect(auditLogRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: TENANT_ID, eventType: 'PAYMENT_ACTION', targetType: 'PaymentGatewayLink' }),
      );
    });

    it('computes amountInPaise from amount + tax', async () => {
      const { service, invoiceRepository, settingsRepository, linkRepository } = createService();
      invoiceRepository.findById.mockResolvedValue(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        createMockInvoice({ amount: { toNumber: () => 1000 } as any, tax: { toNumber: () => 180 } as any }),
      );
      settingsRepository.findByTenantId.mockResolvedValue(createMockSettings());
      const fakeProvider = createConfiguredFakeProvider();
      resolvePaymentGatewayProviderMock.mockReturnValue(fakeProvider);
      linkRepository.create.mockImplementation((data) => Promise.resolve({ id: 'link-2', createdAt: new Date(), ...data }));

      await service.generatePaymentLink({ invoiceId: INVOICE_ID });

      expect(fakeProvider.initializePayment).toHaveBeenCalledWith(expect.objectContaining({ amountInPaise: 118000 }));
    });
  });

  describe('listByInvoice', () => {
    it('throws NotFoundError when the invoice does not belong to this tenant', async () => {
      const { service, invoiceRepository } = createService();
      invoiceRepository.findById.mockResolvedValue(null);

      await expect(service.listByInvoice(INVOICE_ID)).rejects.toThrow(NotFoundError);
    });

    it('lists links scoped to the tenant and invoice', async () => {
      const { service, invoiceRepository, linkRepository } = createService();
      invoiceRepository.findById.mockResolvedValue(createMockInvoice());
      linkRepository.listByInvoice.mockResolvedValue([]);

      await service.listByInvoice(INVOICE_ID);

      expect(linkRepository.listByInvoice).toHaveBeenCalledWith(INVOICE_ID, { tenantId: TENANT_ID });
    });
  });
});
