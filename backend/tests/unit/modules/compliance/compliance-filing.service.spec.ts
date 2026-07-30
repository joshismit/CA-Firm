import { Request } from 'express';
import { ComplianceCategory, ComplianceFiling, ComplianceFilingStatus } from '@prisma/client';

/** See the identical comment in tests/unit/modules/contacts/contact.service.spec.ts for why @config/database is stubbed. */
jest.mock('@config/database', () => ({ prisma: {} }));

import { UserRole } from '@shared/enums';
import { NotFoundError } from '@shared/errors';
import { ComplianceFilingService } from '@modules/compliance/service/compliance-filing.service';
import { ComplianceFilingRepository } from '@modules/compliance/repository/compliance-filing.repository';
import { CreateComplianceFilingDto, UpdateComplianceFilingDto } from '@modules/compliance/dto/compliance-filing.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ComplianceFilingService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The repository is fully mocked — these tests exercise only the business
 * logic in `ComplianceFilingService` (category scoping, existence guards,
 * DTO → repository mapping), never a real database. Mirrors
 * `tests/unit/modules/contacts/contact.service.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';
const FILING_ID = 'filing-33333333-3333-3333-3333-333333333333';

type MockedRepository = {
  [K in 'search' | 'findByIdInCategory' | 'create' | 'update' | 'delete']: jest.Mock;
};

function createMockRepository(): MockedRepository {
  return { search: jest.fn(), findByIdInCategory: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() };
}

function createFakeRequest(): Request {
  return {
    tenant: { id: TENANT_ID, slug: 'acme', name: 'Acme & Co', planCode: 'professional', isActive: true },
    user: { id: USER_ID, email: 'staff@acme.test', role: UserRole.TENANT_ADMIN, tenantId: TENANT_ID, permissions: [] },
    correlationId: 'test-correlation-id',
  } as unknown as Request;
}

function createMockFiling(overrides: Partial<ComplianceFiling> = {}): ComplianceFiling {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: FILING_ID,
    tenantId: TENANT_ID,
    category: ComplianceCategory.GST,
    reference: 'GSTR-3B',
    period: 'Q1 FY26',
    status: ComplianceFilingStatus.DRAFT,
    dueDate: null,
    filedDate: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function createService(repository: MockedRepository, category: ComplianceCategory = ComplianceCategory.GST): ComplianceFilingService {
  return new ComplianceFilingService(createFakeRequest(), category, repository as unknown as ComplianceFilingRepository);
}

describe('ComplianceFilingService', () => {
  // ────────────────────────────────────────────────────────────────────────
  // listFilings
  // ────────────────────────────────────────────────────────────────────────
  describe('listFilings', () => {
    it('delegates to repository.search scoped to this instance\'s category', async () => {
      const repo = createMockRepository();
      const paginated = {
        data: [createMockFiling()],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      };
      repo.search.mockResolvedValue(paginated);

      const service = createService(repo, ComplianceCategory.ITR);
      const result = await service.listFilings({
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        search: 'GSTR',
        status: ComplianceFilingStatus.DRAFT,
      });

      expect(repo.search).toHaveBeenCalledWith(
        { category: ComplianceCategory.ITR, search: 'GSTR', status: ComplianceFilingStatus.DRAFT },
        { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
        { tenantId: TENANT_ID },
      );
      expect(result).toBe(paginated);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // getFilingById
  // ────────────────────────────────────────────────────────────────────────
  describe('getFilingById', () => {
    it('returns the filing when found in this category', async () => {
      const repo = createMockRepository();
      const filing = createMockFiling();
      repo.findByIdInCategory.mockResolvedValue(filing);

      const service = createService(repo);
      const result = await service.getFilingById(FILING_ID);

      expect(repo.findByIdInCategory).toHaveBeenCalledWith(FILING_ID, ComplianceCategory.GST, { tenantId: TENANT_ID });
      expect(result).toBe(filing);
    });

    it('throws NotFoundError when no filing matches (wrong category or missing)', async () => {
      const repo = createMockRepository();
      repo.findByIdInCategory.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.getFilingById('missing-id')).rejects.toThrow(NotFoundError);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // createFiling
  // ────────────────────────────────────────────────────────────────────────
  describe('createFiling', () => {
    it('creates a filing scoped to this category, nulling omitted optional fields', async () => {
      const repo = createMockRepository();
      const created = createMockFiling();
      repo.create.mockResolvedValue(created);

      const service = createService(repo, ComplianceCategory.MCA);
      const dto: CreateComplianceFilingDto = { reference: 'MGT-7', period: 'FY25-26' };
      const result = await service.createFiling(dto);

      expect(repo.create).toHaveBeenCalledWith(
        { category: ComplianceCategory.MCA, reference: 'MGT-7', period: 'FY25-26', dueDate: null, notes: null },
        { tenantId: TENANT_ID },
      );
      expect(result).toBe(created);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // updateFiling
  // ────────────────────────────────────────────────────────────────────────
  describe('updateFiling', () => {
    it('throws NotFoundError when the filing does not exist in this category', async () => {
      const repo = createMockRepository();
      repo.findByIdInCategory.mockResolvedValue(null);

      const service = createService(repo);
      const dto: UpdateComplianceFilingDto = { notes: 'Updated' };

      await expect(service.updateFiling('missing-id', dto)).rejects.toThrow(NotFoundError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('updates the filing when it exists in this category', async () => {
      const repo = createMockRepository();
      repo.findByIdInCategory.mockResolvedValue(createMockFiling());
      const updated = createMockFiling({ notes: 'Updated' });
      repo.update.mockResolvedValue(updated);

      const service = createService(repo);
      const dto: UpdateComplianceFilingDto = { notes: 'Updated' };
      const result = await service.updateFiling(FILING_ID, dto);

      expect(repo.update).toHaveBeenCalledWith(FILING_ID, dto, { tenantId: TENANT_ID });
      expect(result).toBe(updated);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // deleteFiling
  // ────────────────────────────────────────────────────────────────────────
  describe('deleteFiling', () => {
    it('throws NotFoundError when the filing does not exist in this category', async () => {
      const repo = createMockRepository();
      repo.findByIdInCategory.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.deleteFiling('missing-id')).rejects.toThrow(NotFoundError);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('soft-deletes an existing filing', async () => {
      const repo = createMockRepository();
      repo.findByIdInCategory.mockResolvedValue(createMockFiling());
      repo.delete.mockResolvedValue(true);

      const service = createService(repo);
      await service.deleteFiling(FILING_ID);

      expect(repo.delete).toHaveBeenCalledWith(FILING_ID, { tenantId: TENANT_ID });
    });
  });
});
