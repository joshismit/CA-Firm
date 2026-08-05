/** See the identical comment in tests/unit/modules/contacts/contact.service.spec.ts for why @config/database is stubbed. */
jest.mock('@config/database', () => ({ prisma: {} }));

import { Request } from 'express';
import { AuditLog, AuditEventType, Tenant } from '@prisma/client';
import { NotFoundError } from '@shared/errors';
import { MasterAdminAuditService } from '@modules/master-admin/service/master-admin-audit.service';
import { AuditLogRepository } from '@modules/audit/repository/audit-log.repository';
import { TenantRepository } from '@modules/master-admin/repository/tenant.repository';
import type { ListMasterAdminAuditLogsQueryDto } from '@modules/master-admin/dto/master-admin.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * MasterAdminAuditService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Both repositories are fully mocked — exercises only this service's own
 * logic (the `ignoreTenant: true` escape hatch, tenant-name enrichment,
 * dedup of tenant IDs before the batch lookup, not-found guard). Mirrors
 * `tests/unit/modules/audit/audit-log.service.spec.ts`, the tenant-scoped
 * sibling this service intentionally parallels.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_A_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const TENANT_B_ID = 'tenant-22222222-2222-2222-2222-222222222222';
const ACTOR_ID = 'user-33333333-3333-3333-3333-333333333333';
const ENTRY_ID = 'audit-44444444-4444-4444-4444-444444444444';
const MASTER_ADMIN_ID = 'master-admin-99999999-9999-9999-9999-999999999999';

type MockedAuditLogRepository = { [K in 'search' | 'findByIdScoped']: jest.Mock };
type MockedTenantRepository = { findNamesByIds: jest.Mock };

function createMockAuditLogRepository(): MockedAuditLogRepository {
  return { search: jest.fn(), findByIdScoped: jest.fn() };
}

function createMockTenantRepository(): MockedTenantRepository {
  return { findNamesByIds: jest.fn().mockResolvedValue([]) };
}

function createFakeRequest(): Request {
  return { correlationId: 'test-correlation-id', user: { id: MASTER_ADMIN_ID } } as unknown as Request;
}

function createMockAuditLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: ENTRY_ID,
    tenantId: TENANT_A_ID,
    eventType: AuditEventType.LOGIN,
    actorId: ACTOR_ID,
    actorName: 'Integration Test',
    targetType: null,
    targetId: null,
    description: 'staff@acme.test logged in',
    ipAddress: '127.0.0.1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createService(
  auditLogRepository: MockedAuditLogRepository,
  tenantRepository: MockedTenantRepository = createMockTenantRepository(),
): MasterAdminAuditService {
  return new MasterAdminAuditService(
    createFakeRequest(),
    auditLogRepository as unknown as AuditLogRepository,
    tenantRepository as unknown as TenantRepository,
  );
}

describe('MasterAdminAuditService', () => {
  describe('listAuditLogs', () => {
    it('searches with { ignoreTenant: true } and forwards every filter, including the optional tenantId', async () => {
      const auditLogRepo = createMockAuditLogRepository();
      const paginated = {
        data: [createMockAuditLog()],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      };
      auditLogRepo.search.mockResolvedValue(paginated);
      const tenantRepo = createMockTenantRepository();
      tenantRepo.findNamesByIds.mockResolvedValue([{ id: TENANT_A_ID, name: 'Acme & Co' } as Pick<Tenant, 'id' | 'name'>]);

      const service = createService(auditLogRepo, tenantRepo);
      const query: ListMasterAdminAuditLogsQueryDto = {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        search: 'logged in',
        tenantId: TENANT_A_ID,
        eventType: AuditEventType.LOGIN,
        actorId: ACTOR_ID,
        targetType: 'Document',
        from: new Date('2026-01-01'),
        to: new Date('2026-01-31'),
      };

      const result = await service.listAuditLogs(query);

      expect(auditLogRepo.search).toHaveBeenCalledWith(
        {
          tenantId: TENANT_A_ID,
          search: 'logged in',
          eventType: AuditEventType.LOGIN,
          actorId: ACTOR_ID,
          targetType: 'Document',
          from: new Date('2026-01-01'),
          to: new Date('2026-01-31'),
        },
        { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
        { ignoreTenant: true },
      );
      expect(result.data).toEqual([
        expect.objectContaining({ id: ENTRY_ID, tenantId: TENANT_A_ID, tenantName: 'Acme & Co' }),
      ]);
      expect(result.meta).toBe(paginated.meta);
    });

    it('omits tenantId from the search filter when the caller does not filter by tenant (cross-tenant view)', async () => {
      const auditLogRepo = createMockAuditLogRepository();
      auditLogRepo.search.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false },
      });

      const service = createService(auditLogRepo);
      await service.listAuditLogs({ page: 1, limit: 20 } as ListMasterAdminAuditLogsQueryDto);

      expect(auditLogRepo.search).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: undefined }),
        expect.anything(),
        { ignoreTenant: true },
      );
    });

    it('resolves tenant names for every distinct tenant across the page in a single batched lookup', async () => {
      const auditLogRepo = createMockAuditLogRepository();
      auditLogRepo.search.mockResolvedValue({
        data: [
          createMockAuditLog({ id: 'entry-a', tenantId: TENANT_A_ID }),
          createMockAuditLog({ id: 'entry-a2', tenantId: TENANT_A_ID }),
          createMockAuditLog({ id: 'entry-b', tenantId: TENANT_B_ID }),
        ],
        meta: { page: 1, limit: 20, total: 3, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      });
      const tenantRepo = createMockTenantRepository();
      tenantRepo.findNamesByIds.mockResolvedValue([
        { id: TENANT_A_ID, name: 'Acme & Co' } as Pick<Tenant, 'id' | 'name'>,
        { id: TENANT_B_ID, name: 'Beta LLP' } as Pick<Tenant, 'id' | 'name'>,
      ]);

      const service = createService(auditLogRepo, tenantRepo);
      const result = await service.listAuditLogs({ page: 1, limit: 20 } as ListMasterAdminAuditLogsQueryDto);

      // Called once, with the two distinct tenant IDs (not three, not one call per row).
      expect(tenantRepo.findNamesByIds).toHaveBeenCalledTimes(1);
      expect(tenantRepo.findNamesByIds).toHaveBeenCalledWith([TENANT_A_ID, TENANT_B_ID]);
      expect(result.data.map((entry) => entry.tenantName)).toEqual(['Acme & Co', 'Acme & Co', 'Beta LLP']);
    });

    it('falls back to a null tenantName when the tenant row cannot be resolved (e.g. deleted)', async () => {
      const auditLogRepo = createMockAuditLogRepository();
      auditLogRepo.search.mockResolvedValue({
        data: [createMockAuditLog({ tenantId: TENANT_A_ID })],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      });
      const tenantRepo = createMockTenantRepository();
      tenantRepo.findNamesByIds.mockResolvedValue([]);

      const service = createService(auditLogRepo, tenantRepo);
      const result = await service.listAuditLogs({ page: 1, limit: 20 } as ListMasterAdminAuditLogsQueryDto);

      expect(result.data[0].tenantName).toBeNull();
    });

    it('does not call findNamesByIds when the page is empty', async () => {
      const auditLogRepo = createMockAuditLogRepository();
      auditLogRepo.search.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false },
      });
      const tenantRepo = createMockTenantRepository();

      const service = createService(auditLogRepo, tenantRepo);
      await service.listAuditLogs({ page: 1, limit: 20 } as ListMasterAdminAuditLogsQueryDto);

      expect(tenantRepo.findNamesByIds).not.toHaveBeenCalled();
    });
  });

  describe('getAuditLogById', () => {
    it('looks up the entry with { ignoreTenant: true } and enriches it with the tenant name', async () => {
      const auditLogRepo = createMockAuditLogRepository();
      auditLogRepo.findByIdScoped.mockResolvedValue(createMockAuditLog({ tenantId: TENANT_A_ID }));
      const tenantRepo = createMockTenantRepository();
      tenantRepo.findNamesByIds.mockResolvedValue([{ id: TENANT_A_ID, name: 'Acme & Co' } as Pick<Tenant, 'id' | 'name'>]);

      const service = createService(auditLogRepo, tenantRepo);
      const result = await service.getAuditLogById(ENTRY_ID);

      expect(auditLogRepo.findByIdScoped).toHaveBeenCalledWith(ENTRY_ID, { ignoreTenant: true });
      expect(result).toMatchObject({ id: ENTRY_ID, tenantId: TENANT_A_ID, tenantName: 'Acme & Co' });
    });

    it('throws NotFoundError when no entry matches (missing, in any tenant)', async () => {
      const auditLogRepo = createMockAuditLogRepository();
      auditLogRepo.findByIdScoped.mockResolvedValue(null);

      const service = createService(auditLogRepo);

      await expect(service.getAuditLogById('missing-id')).rejects.toThrow(NotFoundError);
    });
  });
});
