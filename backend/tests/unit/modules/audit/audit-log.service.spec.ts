import { Request } from 'express';
import { AuditLog, AuditEventType } from '@prisma/client';

/** See the identical comment in tests/unit/modules/contacts/contact.service.spec.ts for why @config/database is stubbed. */
jest.mock('@config/database', () => ({ prisma: {} }));

import { UserRole } from '@shared/enums';
import { NotFoundError } from '@shared/errors';
import { AuditLogService } from '@modules/audit/service/audit-log.service';
import { AuditLogRepository } from '@modules/audit/repository/audit-log.repository';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * AuditLogService — Unit Tests (read side)
 * ─────────────────────────────────────────────────────────────────────────────
 * The repository is fully mocked — exercises only AuditLogService's business
 * logic (tenant scoping, filter pass-through, not-found guard). Mirrors
 * `tests/unit/modules/notifications/notification.service.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';
const ENTRY_ID = 'audit-44444444-4444-4444-4444-444444444444';

type MockedRepository = { [K in 'search' | 'findByIdScoped']: jest.Mock };

function createMockRepository(): MockedRepository {
  return { search: jest.fn(), findByIdScoped: jest.fn() };
}

function createFakeRequest(): Request {
  return {
    tenant: { id: TENANT_ID, slug: 'acme', name: 'Acme & Co', planCode: 'professional', isActive: true },
    user: { id: USER_ID, email: 'staff@acme.test', role: UserRole.TENANT_ADMIN, tenantId: TENANT_ID, permissions: [] },
    correlationId: 'test-correlation-id',
  } as unknown as Request;
}

function createMockAuditLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: ENTRY_ID,
    tenantId: TENANT_ID,
    eventType: AuditEventType.LOGIN,
    actorId: USER_ID,
    actorName: 'Integration Test',
    targetType: null,
    targetId: null,
    description: 'staff@acme.test logged in',
    ipAddress: '127.0.0.1',
    userAgent: null,
    oldValue: null,
    newValue: null,
    metadata: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createService(repository: MockedRepository): AuditLogService {
  return new AuditLogService(createFakeRequest(), repository as unknown as AuditLogRepository);
}

describe('AuditLogService', () => {
  describe('listAuditLogs', () => {
    it('delegates to repository.search scoped to the caller tenant', async () => {
      const repo = createMockRepository();
      const paginated = {
        data: [createMockAuditLog()],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      };
      repo.search.mockResolvedValue(paginated);

      const service = createService(repo);
      const result = await service.listAuditLogs({
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        search: 'logged in',
        eventType: AuditEventType.LOGIN,
        actorId: USER_ID,
        targetType: 'Document',
        from: new Date('2026-01-01'),
        to: new Date('2026-01-31'),
      });

      expect(repo.search).toHaveBeenCalledWith(
        {
          search: 'logged in',
          eventType: AuditEventType.LOGIN,
          actorId: USER_ID,
          targetType: 'Document',
          from: new Date('2026-01-01'),
          to: new Date('2026-01-31'),
        },
        { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
        { tenantId: TENANT_ID },
      );
      expect(result).toBe(paginated);
    });
  });

  describe('getAuditLogById', () => {
    it('returns the entry when found in this tenant', async () => {
      const repo = createMockRepository();
      const entry = createMockAuditLog();
      repo.findByIdScoped.mockResolvedValue(entry);

      const service = createService(repo);
      const result = await service.getAuditLogById(ENTRY_ID);

      expect(repo.findByIdScoped).toHaveBeenCalledWith(ENTRY_ID, { tenantId: TENANT_ID });
      expect(result).toBe(entry);
    });

    it('throws NotFoundError when no entry matches (missing, or belongs to another tenant)', async () => {
      const repo = createMockRepository();
      repo.findByIdScoped.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.getAuditLogById('missing-id')).rejects.toThrow(NotFoundError);
    });
  });
});
