import { Request } from 'express';
import { Business, BusinessStatus, BusinessType } from '@prisma/client';

/**
 * See the identical comment in
 * tests/unit/modules/projects/project.service.spec.ts — importing
 * `BusinessService` transitively imports `@config/database`, whose top-level
 * `new PrismaClient(...)` call currently throws at construction time
 * (pre-existing Prisma 7 driver-adapter issue, unrelated to this module).
 * Stubbing the module here is test-only and does not touch production code.
 */
jest.mock('@config/database', () => ({ prisma: {} }));
import { AuditEventType } from '@prisma/client';
import { UserRole } from '@shared/enums';
import { NotFoundError } from '@shared/errors';
import { BusinessService } from '@modules/business/service/business.service';
import { BusinessRepository } from '@modules/business/repository/business.repository';
import { BusinessTypeRepository } from '@modules/business/repository/business-type.repository';
import { StorageQuotaService } from '@modules/documents';
import { AuditLogRecorder } from '@modules/audit';
import { CreateBusinessDto, ListBusinessesQueryDto, UpdateBusinessDto } from '@modules/business/dto/business.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * BusinessService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Both repositories are fully mocked — these tests exercise only the
 * business logic in `BusinessService` (existence guards, DTO → repository
 * mapping), never a real database. Mocks are injected via the service's
 * constructor DI parameters, exactly as designed for this. Mirrors
 * `tests/unit/modules/projects/project.service.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';
const TYPE_ID = 'type-55555555-5555-5555-5555-555555555555';

type MockedBusinessRepository = {
  [K in 'findById' | 'create' | 'update' | 'delete' | 'search']: jest.Mock;
};

type MockedBusinessTypeRepository = {
  [K in 'listActive']: jest.Mock;
};

type MockedStorageQuotaService = { [K in 'getBusinessStorageSummary']: jest.Mock };
type MockedAuditLogRecorder = { record: jest.Mock };

function createMockRepository(): MockedBusinessRepository {
  return {
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    search: jest.fn(),
  };
}

function createMockTypeRepository(): MockedBusinessTypeRepository {
  return { listActive: jest.fn() };
}

function createMockStorageQuotaService(): MockedStorageQuotaService {
  return {
    getBusinessStorageSummary: jest.fn().mockResolvedValue({ usedBytes: 0, quotaBytes: 500 * 1024 * 1024, remainingBytes: 500 * 1024 * 1024 }),
  };
}

function createMockAuditLogRecorder(): MockedAuditLogRecorder {
  return { record: jest.fn().mockResolvedValue(undefined) };
}

function createFakeRequest(): Request {
  return {
    tenant: { id: TENANT_ID, slug: 'acme', name: 'Acme & Co', planCode: 'professional', isActive: true },
    user: { id: USER_ID, email: 'manager@acme.test', role: UserRole.TENANT_ADMIN, tenantId: TENANT_ID, permissions: [] },
    correlationId: 'test-correlation-id',
  } as unknown as Request;
}

function createMockBusiness(overrides: Partial<Business> = {}): Business {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'business-33333333-3333-3333-3333-333333333333',
    tenantId: TENANT_ID,
    typeId: TYPE_ID,
    name: 'Acme Manufacturing Pvt Ltd',
    legalName: null,
    status: BusinessStatus.ACTIVE,
    pan: null,
    gstin: null,
    cin: null,
    incorporationDate: null,
    financialYearStart: 4,
    industry: null,
    storageQuotaMb: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdBy: USER_ID,
    deletedBy: null,
    ...overrides,
  };
}

function createMockBusinessType(overrides: Partial<BusinessType> = {}): BusinessType {
  return {
    id: TYPE_ID,
    code: 'PRIVATE_LIMITED',
    name: 'Private Limited',
    description: null,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createService(
  repository: MockedBusinessRepository,
  typeRepository: MockedBusinessTypeRepository = createMockTypeRepository(),
  storageQuotaService: MockedStorageQuotaService = createMockStorageQuotaService(),
  auditLogRecorder: MockedAuditLogRecorder = createMockAuditLogRecorder(),
): BusinessService {
  return new BusinessService(
    createFakeRequest(),
    repository as unknown as BusinessRepository,
    typeRepository as unknown as BusinessTypeRepository,
    storageQuotaService as unknown as StorageQuotaService,
    auditLogRecorder as unknown as AuditLogRecorder,
  );
}

describe('BusinessService', () => {
  // ────────────────────────────────────────────────────────────────────────
  // createBusiness
  // ────────────────────────────────────────────────────────────────────────
  describe('createBusiness', () => {
    const dto: CreateBusinessDto = {
      typeId: TYPE_ID,
      name: 'Acme Manufacturing Pvt Ltd',
    };

    it('creates a business, defaulting financialYearStart to 4 and nullable fields to null', async () => {
      const repo = createMockRepository();
      const created = createMockBusiness();
      repo.create.mockResolvedValue(created);

      const service = createService(repo);
      const result = await service.createBusiness(dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          typeId: TYPE_ID,
          name: dto.name,
          legalName: null,
          pan: null,
          gstin: null,
          cin: null,
          incorporationDate: null,
          financialYearStart: 4,
          industry: null,
          createdBy: USER_ID,
        }),
        { tenantId: TENANT_ID },
      );
      expect(result).toBe(created);
    });

    it('passes through explicit optional fields instead of defaulting them', async () => {
      const repo = createMockRepository();
      const fullDto: CreateBusinessDto = {
        typeId: TYPE_ID,
        name: 'Acme Manufacturing Pvt Ltd',
        legalName: 'Acme Manufacturing Private Limited',
        pan: 'ABCDE1234F',
        gstin: '27ABCDE1234F1Z5',
        cin: 'U12345MH2020PTC123456',
        incorporationDate: new Date('2020-04-01'),
        financialYearStart: 1,
        industry: 'Manufacturing',
      };
      repo.create.mockResolvedValue(createMockBusiness());

      const service = createService(repo);
      await service.createBusiness(fullDto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          legalName: fullDto.legalName,
          pan: fullDto.pan,
          gstin: fullDto.gstin,
          cin: fullDto.cin,
          incorporationDate: fullDto.incorporationDate,
          financialYearStart: 1,
          industry: fullDto.industry,
        }),
        { tenantId: TENANT_ID },
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // updateBusiness
  // ────────────────────────────────────────────────────────────────────────
  describe('updateBusiness', () => {
    it('throws NotFoundError when the business does not exist', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);
      const dto: UpdateBusinessDto = { name: 'Renamed' };

      await expect(service.updateBusiness('missing-id', dto)).rejects.toThrow(NotFoundError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('updates the business when it exists', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockBusiness());
      const updated = createMockBusiness({ name: 'Acme Manufacturing (Renamed)' });
      repo.update.mockResolvedValue(updated);

      const service = createService(repo);
      const dto: UpdateBusinessDto = { name: 'Acme Manufacturing (Renamed)' };
      const result = await service.updateBusiness('business-1', dto);

      expect(repo.update).toHaveBeenCalledWith('business-1', dto, { tenantId: TENANT_ID });
      expect(result).toBe(updated);
    });

    // ────────────────────────────────────────────────────────────────────
    // storageQuotaMb (PRD §7.4) — audit-logged only when it actually changes
    // ────────────────────────────────────────────────────────────────────
    it('audit-logs a SETTINGS_UPDATE entry when storageQuotaMb changes', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockBusiness({ storageQuotaMb: null }));
      repo.update.mockResolvedValue(createMockBusiness({ storageQuotaMb: 1000 }));
      const auditLogRecorder = createMockAuditLogRecorder();

      const service = createService(repo, createMockTypeRepository(), createMockStorageQuotaService(), auditLogRecorder);
      await service.updateBusiness('business-1', { storageQuotaMb: 1000 });

      expect(auditLogRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          actorId: USER_ID,
          eventType: AuditEventType.SETTINGS_UPDATE,
          targetType: 'Business',
          targetId: 'business-33333333-3333-3333-3333-333333333333',
        }),
      );
    });

    it('does not audit-log when storageQuotaMb is absent from the update payload', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockBusiness({ storageQuotaMb: null }));
      repo.update.mockResolvedValue(createMockBusiness({ name: 'Renamed only' }));
      const auditLogRecorder = createMockAuditLogRecorder();

      const service = createService(repo, createMockTypeRepository(), createMockStorageQuotaService(), auditLogRecorder);
      await service.updateBusiness('business-1', { name: 'Renamed only' });

      expect(auditLogRecorder.record).not.toHaveBeenCalled();
    });

    it('does not audit-log a no-op re-set to the same storageQuotaMb value', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockBusiness({ storageQuotaMb: 1000 }));
      repo.update.mockResolvedValue(createMockBusiness({ storageQuotaMb: 1000 }));
      const auditLogRecorder = createMockAuditLogRecorder();

      const service = createService(repo, createMockTypeRepository(), createMockStorageQuotaService(), auditLogRecorder);
      await service.updateBusiness('business-1', { storageQuotaMb: 1000 });

      expect(auditLogRecorder.record).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // deleteBusiness
  // ────────────────────────────────────────────────────────────────────────
  describe('deleteBusiness', () => {
    it('throws NotFoundError when the business does not exist', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.deleteBusiness('missing-id')).rejects.toThrow(NotFoundError);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('soft-deletes an existing business', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockBusiness());
      repo.delete.mockResolvedValue(true);

      const service = createService(repo);
      await service.deleteBusiness('business-1');

      expect(repo.delete).toHaveBeenCalledWith('business-1', { tenantId: TENANT_ID, userId: USER_ID });
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // getBusinessById
  // ────────────────────────────────────────────────────────────────────────
  describe('getBusinessById', () => {
    it('returns the business when found', async () => {
      const repo = createMockRepository();
      const business = createMockBusiness();
      repo.findById.mockResolvedValue(business);

      const service = createService(repo);
      const result = await service.getBusinessById(business.id);

      expect(repo.findById).toHaveBeenCalledWith(business.id, { tenantId: TENANT_ID });
      expect(result).toBe(business);
    });

    it('throws NotFoundError when no business matches the ID', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.getBusinessById('missing-id')).rejects.toThrow(NotFoundError);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // getBusinessStorageUsage (PRD §7.4)
  // ────────────────────────────────────────────────────────────────────────
  describe('getBusinessStorageUsage', () => {
    it('throws NotFoundError when no business matches the ID', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);
      const storageQuotaService = createMockStorageQuotaService();

      const service = createService(repo, createMockTypeRepository(), storageQuotaService);

      await expect(service.getBusinessStorageUsage('missing-id')).rejects.toThrow(NotFoundError);
      expect(storageQuotaService.getBusinessStorageSummary).not.toHaveBeenCalled();
    });

    it('delegates to StorageQuotaService.getBusinessStorageSummary, reusing the same engine DocumentService enforces uploads against', async () => {
      const repo = createMockRepository();
      const business = createMockBusiness();
      repo.findById.mockResolvedValue(business);
      const storageQuotaService = createMockStorageQuotaService();
      const summary = { usedBytes: 12_345, quotaBytes: 500 * 1024 * 1024, remainingBytes: 500 * 1024 * 1024 - 12_345 };
      storageQuotaService.getBusinessStorageSummary.mockResolvedValue(summary);

      const service = createService(repo, createMockTypeRepository(), storageQuotaService);
      const result = await service.getBusinessStorageUsage(business.id);

      expect(storageQuotaService.getBusinessStorageSummary).toHaveBeenCalledWith(TENANT_ID, business.id);
      expect(result).toBe(summary);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // listBusinesses
  // ────────────────────────────────────────────────────────────────────────
  describe('listBusinesses', () => {
    it('delegates to repository.search with the filters and pagination mapped from the query', async () => {
      const repo = createMockRepository();
      const businesses = [createMockBusiness(), createMockBusiness({ id: 'business-2' })];
      const paginated = {
        data: businesses,
        meta: { page: 1, limit: 20, total: 2, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      };
      repo.search.mockResolvedValue(paginated);

      const service = createService(repo);
      const query: ListBusinessesQueryDto = {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        search: 'acme',
        typeId: TYPE_ID,
        status: BusinessStatus.ACTIVE,
      };

      const result = await service.listBusinesses(query);

      expect(repo.search).toHaveBeenCalledWith(
        { typeId: TYPE_ID, status: BusinessStatus.ACTIVE, search: 'acme' },
        { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
        { tenantId: TENANT_ID },
      );
      expect(result).toBe(paginated);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // listBusinessTypes
  // ────────────────────────────────────────────────────────────────────────
  describe('listBusinessTypes', () => {
    it('delegates to businessTypeRepository.listActive', async () => {
      const repo = createMockRepository();
      const typeRepo = createMockTypeRepository();
      const types = [createMockBusinessType()];
      typeRepo.listActive.mockResolvedValue(types);

      const service = createService(repo, typeRepo);
      const result = await service.listBusinessTypes();

      expect(typeRepo.listActive).toHaveBeenCalled();
      expect(result).toBe(types);
    });
  });
});
