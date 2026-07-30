import { Request } from 'express';
import { Invoice, InvoiceStatus } from '@prisma/client';

/** See the identical comment in tests/unit/modules/contacts/contact.service.spec.ts for why @config/database is stubbed. */
jest.mock('@config/database', () => ({ prisma: {} }));

import { UserRole } from '@shared/enums';
import { NotFoundError } from '@shared/errors';
import { InvoiceService } from '@modules/client-billing/service/invoice.service';
import { InvoiceRepository } from '@modules/client-billing/repository/invoice.repository';
import { CreateInvoiceDto, UpdateInvoiceDto } from '@modules/client-billing/dto/invoice.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * InvoiceService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * The repository is fully mocked — exercises only InvoiceService's business
 * logic (existence guards, cross-tenant clientId/businessId validation, DTO
 * → repository mapping). Mirrors
 * `tests/unit/modules/contacts/contact.service.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';
const INVOICE_ID = 'invoice-33333333-3333-3333-3333-333333333333';
const CLIENT_ID = 'client-44444444-4444-4444-4444-444444444444';
const BUSINESS_ID = 'business-55555555-5555-5555-5555-555555555555';

type MockedRepository = {
  [K in 'search' | 'findById' | 'create' | 'update' | 'delete' | 'clientExistsInTenant' | 'businessExistsInTenant']: jest.Mock;
};

function createMockRepository(): MockedRepository {
  return {
    search: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    clientExistsInTenant: jest.fn(),
    businessExistsInTenant: jest.fn(),
  };
}

function createFakeRequest(): Request {
  return {
    tenant: { id: TENANT_ID, slug: 'acme', name: 'Acme & Co', planCode: 'professional', isActive: true },
    user: { id: USER_ID, email: 'staff@acme.test', role: UserRole.TENANT_ADMIN, tenantId: TENANT_ID, permissions: [] },
    correlationId: 'test-correlation-id',
  } as unknown as Request;
}

function createMockInvoice(overrides: Partial<Invoice> = {}): Invoice {
  const now = new Date('2026-01-01T00:00:00.000Z');
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
    status: InvoiceStatus.DRAFT,
    notes: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function createService(repository: MockedRepository): InvoiceService {
  return new InvoiceService(createFakeRequest(), repository as unknown as InvoiceRepository);
}

describe('InvoiceService', () => {
  describe('getInvoiceById', () => {
    it('returns the invoice when found', async () => {
      const repo = createMockRepository();
      const invoice = createMockInvoice();
      repo.findById.mockResolvedValue(invoice);

      const service = createService(repo);
      const result = await service.getInvoiceById(INVOICE_ID);

      expect(repo.findById).toHaveBeenCalledWith(INVOICE_ID, { tenantId: TENANT_ID });
      expect(result).toBe(invoice);
    });

    it('throws NotFoundError when no invoice matches', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.getInvoiceById('missing-id')).rejects.toThrow(NotFoundError);
    });
  });

  describe('listInvoices', () => {
    it('delegates to repository.search', async () => {
      const repo = createMockRepository();
      const paginated = { data: [createMockInvoice()], meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false } };
      repo.search.mockResolvedValue(paginated);

      const service = createService(repo);
      const result = await service.listInvoices({ page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc', search: 'INV', status: InvoiceStatus.DRAFT });

      expect(repo.search).toHaveBeenCalledWith(
        { search: 'INV', status: InvoiceStatus.DRAFT },
        { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
        { tenantId: TENANT_ID },
      );
      expect(result).toBe(paginated);
    });
  });

  describe('createInvoice', () => {
    const dto: CreateInvoiceDto = { invoiceNumber: 'INV-001', amount: 1000, clientId: CLIENT_ID, businessId: BUSINESS_ID };

    it('throws NotFoundError when clientId does not exist in this tenant', async () => {
      const repo = createMockRepository();
      repo.clientExistsInTenant.mockResolvedValue(false);

      const service = createService(repo);

      await expect(service.createInvoice(dto)).rejects.toThrow(NotFoundError);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when businessId does not exist in this tenant', async () => {
      const repo = createMockRepository();
      repo.clientExistsInTenant.mockResolvedValue(true);
      repo.businessExistsInTenant.mockResolvedValue(false);

      const service = createService(repo);

      await expect(service.createInvoice(dto)).rejects.toThrow(NotFoundError);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('creates the invoice once references are valid, nulling omitted optional fields', async () => {
      const repo = createMockRepository();
      repo.clientExistsInTenant.mockResolvedValue(true);
      repo.businessExistsInTenant.mockResolvedValue(true);
      const created = createMockInvoice();
      repo.create.mockResolvedValue(created);

      const service = createService(repo);
      const result = await service.createInvoice(dto);

      expect(repo.create).toHaveBeenCalledWith(
        { invoiceNumber: 'INV-001', clientId: CLIENT_ID, businessId: BUSINESS_ID, amount: 1000, tax: 0, dueDate: null, notes: null },
        { tenantId: TENANT_ID },
      );
      expect(result).toBe(created);
    });

    it('creates an invoice with no clientId/businessId without checking references', async () => {
      const repo = createMockRepository();
      const created = createMockInvoice();
      repo.create.mockResolvedValue(created);

      const service = createService(repo);
      await service.createInvoice({ invoiceNumber: 'INV-002', amount: 500 });

      expect(repo.clientExistsInTenant).not.toHaveBeenCalled();
      expect(repo.businessExistsInTenant).not.toHaveBeenCalled();
      expect(repo.create).toHaveBeenCalled();
    });
  });

  describe('updateInvoice', () => {
    it('throws NotFoundError when the invoice does not exist', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);
      const dto: UpdateInvoiceDto = { notes: 'Updated' };

      await expect(service.updateInvoice('missing-id', dto)).rejects.toThrow(NotFoundError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('updates the invoice when it exists and references are valid', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockInvoice());
      const updated = createMockInvoice({ notes: 'Updated' });
      repo.update.mockResolvedValue(updated);

      const service = createService(repo);
      const dto: UpdateInvoiceDto = { notes: 'Updated' };
      const result = await service.updateInvoice(INVOICE_ID, dto);

      expect(repo.update).toHaveBeenCalledWith(INVOICE_ID, dto, { tenantId: TENANT_ID });
      expect(result).toBe(updated);
    });
  });

  describe('deleteInvoice', () => {
    it('throws NotFoundError when the invoice does not exist', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.deleteInvoice('missing-id')).rejects.toThrow(NotFoundError);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('soft-deletes an existing invoice', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockInvoice());
      repo.delete.mockResolvedValue(true);

      const service = createService(repo);
      await service.deleteInvoice(INVOICE_ID);

      expect(repo.delete).toHaveBeenCalledWith(INVOICE_ID, { tenantId: TENANT_ID });
    });
  });
});
