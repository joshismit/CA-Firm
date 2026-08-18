import { Request } from 'express';
import { Payment, PaymentStatus } from '@prisma/client';

jest.mock('@config/database', () => ({ prisma: {} }));

import { UserRole } from '@shared/enums';
import { NotFoundError } from '@shared/errors';
import { PaymentService } from '@modules/client-billing/service/payment.service';
import { PaymentRepository } from '@modules/client-billing/repository/payment.repository';
import { InvoiceRepository } from '@modules/client-billing/repository/invoice.repository';
import { CreatePaymentDto, UpdatePaymentDto } from '@modules/client-billing/dto/payment.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PaymentService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Both the repository and the composed `InvoiceRepository` (for the
 * cross-tenant `invoiceId` guard) are mocked. Mirrors
 * `tests/unit/modules/client-billing/invoice.service.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';
const PAYMENT_ID = 'payment-33333333-3333-3333-3333-333333333333';
const INVOICE_ID = 'invoice-44444444-4444-4444-4444-444444444444';

type MockedPaymentRepository = { [K in 'search' | 'findById' | 'create' | 'update' | 'delete']: jest.Mock };
type MockedInvoiceRepository = { findById: jest.Mock };

function createMockRepository(): MockedPaymentRepository {
  return { search: jest.fn(), findById: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() };
}

function createMockInvoiceRepository(): MockedInvoiceRepository {
  return { findById: jest.fn() };
}

function createFakeRequest(): Request {
  return {
    tenant: { id: TENANT_ID, slug: 'acme', name: 'Acme & Co', planCode: 'professional', isActive: true },
    user: { id: USER_ID, email: 'staff@acme.test', role: UserRole.TENANT_ADMIN, tenantId: TENANT_ID, permissions: [] },
    correlationId: 'test-correlation-id',
  } as unknown as Request;
}

function createMockPayment(overrides: Partial<Payment> = {}): Payment {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: PAYMENT_ID,
    tenantId: TENANT_ID,
    paymentNumber: 'PAY-001',
    invoiceId: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    amount: { toNumber: () => 1000 } as any,
    method: null,
    reference: null,
    paidDate: null,
    status: PaymentStatus.PENDING,
    notes: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function createService(repository: MockedPaymentRepository, invoiceRepository: MockedInvoiceRepository = createMockInvoiceRepository()): PaymentService {
  return new PaymentService(createFakeRequest(), repository as unknown as PaymentRepository, invoiceRepository as unknown as InvoiceRepository);
}

describe('PaymentService', () => {
  describe('getPaymentById', () => {
    it('returns the payment when found', async () => {
      const repo = createMockRepository();
      const payment = createMockPayment();
      repo.findById.mockResolvedValue(payment);

      const service = createService(repo);
      const result = await service.getPaymentById(PAYMENT_ID);

      expect(result).toBe(payment);
    });

    it('throws NotFoundError when no payment matches', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.getPaymentById('missing-id')).rejects.toThrow(NotFoundError);
    });
  });

  describe('createPayment', () => {
    it('throws NotFoundError when invoiceId does not exist in this tenant', async () => {
      const repo = createMockRepository();
      const invoiceRepo = createMockInvoiceRepository();
      invoiceRepo.findById.mockResolvedValue(null);

      const service = createService(repo, invoiceRepo);
      const dto: CreatePaymentDto = { paymentNumber: 'PAY-001', amount: 1000, invoiceId: INVOICE_ID };

      await expect(service.createPayment(dto)).rejects.toThrow(NotFoundError);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('creates the payment once the invoice reference is valid', async () => {
      const repo = createMockRepository();
      const invoiceRepo = createMockInvoiceRepository();
      invoiceRepo.findById.mockResolvedValue({ id: INVOICE_ID });
      const created = createMockPayment({ invoiceId: INVOICE_ID });
      repo.create.mockResolvedValue(created);

      const service = createService(repo, invoiceRepo);
      const dto: CreatePaymentDto = { paymentNumber: 'PAY-001', amount: 1000, invoiceId: INVOICE_ID };
      const result = await service.createPayment(dto);

      expect(invoiceRepo.findById).toHaveBeenCalledWith(INVOICE_ID, { tenantId: TENANT_ID });
      expect(repo.create).toHaveBeenCalledWith(
        { paymentNumber: 'PAY-001', invoiceId: INVOICE_ID, amount: 1000, method: null, reference: null, paidDate: null, notes: null },
        { tenantId: TENANT_ID },
      );
      expect(result).toBe(created);
    });

    it('creates a payment with no invoiceId without checking the reference', async () => {
      const repo = createMockRepository();
      const invoiceRepo = createMockInvoiceRepository();
      repo.create.mockResolvedValue(createMockPayment());

      const service = createService(repo, invoiceRepo);
      await service.createPayment({ paymentNumber: 'PAY-002', amount: 200 });

      expect(invoiceRepo.findById).not.toHaveBeenCalled();
      expect(repo.create).toHaveBeenCalled();
    });
  });

  describe('updatePayment', () => {
    it('throws NotFoundError when the payment does not exist', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);
      const dto: UpdatePaymentDto = { notes: 'Updated' };

      await expect(service.updatePayment('missing-id', dto)).rejects.toThrow(NotFoundError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('updates the payment when it exists', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockPayment());
      const updated = createMockPayment({ notes: 'Updated' });
      repo.update.mockResolvedValue(updated);

      const service = createService(repo);
      const result = await service.updatePayment(PAYMENT_ID, { notes: 'Updated' });

      expect(repo.update).toHaveBeenCalledWith(PAYMENT_ID, { notes: 'Updated' }, { tenantId: TENANT_ID });
      expect(result).toBe(updated);
    });
  });

  describe('deletePayment', () => {
    it('throws NotFoundError when the payment does not exist', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.deletePayment('missing-id')).rejects.toThrow(NotFoundError);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('soft-deletes an existing payment', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockPayment());
      repo.delete.mockResolvedValue(true);

      const service = createService(repo);
      await service.deletePayment(PAYMENT_ID);

      expect(repo.delete).toHaveBeenCalledWith(PAYMENT_ID, { tenantId: TENANT_ID });
    });
  });
});
