import { Request } from 'express';
import { DashboardTenantDefault } from '@prisma/client';

/** See the identical comment in tests/unit/modules/documents/document.service.spec.ts for why @config/database is stubbed. */
jest.mock('@config/database', () => ({ prisma: {} }));

import { UserRole } from '@shared/enums';
import { DashboardTenantDefaultService } from '@modules/dashboard/service/dashboard-tenant-default.service';
import { DashboardTenantDefaultRepository } from '@modules/dashboard/repository/dashboard-tenant-default.repository';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DashboardTenantDefaultService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Mirrors `dashboard-preference.service.spec.ts` exactly, one level up
 * (tenant+role instead of user).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const ADMIN_USER_ID = 'user-99999999-9999-9999-9999-999999999999';

type MockedRepository = { [K in 'listByTenant' | 'upsert' | 'deleteByTenantAndRole']: jest.Mock };

function createMockRepository(): MockedRepository {
  return { listByTenant: jest.fn(), upsert: jest.fn(), deleteByTenantAndRole: jest.fn() };
}

function createFakeRequest(): Request {
  return {
    tenant: { id: TENANT_ID, slug: 'acme', name: 'Acme & Co', planCode: 'professional', isActive: true },
    user: { id: ADMIN_USER_ID, email: 'admin@acme.test', role: UserRole.TENANT_ADMIN, tenantId: TENANT_ID, permissions: [] },
    correlationId: 'test-correlation-id',
  } as unknown as Request;
}

function createMockRow(overrides: Partial<DashboardTenantDefault> = {}): DashboardTenantDefault {
  return {
    id: 'row-id',
    tenantId: TENANT_ID,
    role: UserRole.STAFF,
    widgets: [{ widgetId: 'task-summary', visible: true }],
    updatedBy: ADMIN_USER_ID,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  } as DashboardTenantDefault;
}

function createService(repo: MockedRepository): DashboardTenantDefaultService {
  return new DashboardTenantDefaultService(createFakeRequest(), repo as unknown as DashboardTenantDefaultRepository);
}

describe('DashboardTenantDefaultService', () => {
  describe('listDefaults', () => {
    it('returns one entry per UserRole value, configured or not', async () => {
      const repo = createMockRepository();
      repo.listByTenant.mockResolvedValue([createMockRow({ role: UserRole.STAFF })]);

      const result = await createService(repo).listDefaults();

      expect(result).toHaveLength(Object.values(UserRole).length);
      const staffEntry = result.find((r) => r.role === UserRole.STAFF);
      expect(staffEntry?.widgets).toEqual([{ widgetId: 'task-summary', visible: true }]);
      expect(staffEntry?.updatedAt).toBe('2026-01-02T00:00:00.000Z');

      const unconfigured = result.find((r) => r.role === UserRole.MANAGER);
      expect(unconfigured?.widgets).toEqual([]);
      expect(unconfigured?.updatedAt).toBeNull();
    });
  });

  describe('upsertDefault', () => {
    it('upserts scoped to tenant + role, stamping the caller as updatedBy', async () => {
      const repo = createMockRepository();
      const widgets = [{ widgetId: 'kpi-stats', visible: true }];
      repo.upsert.mockResolvedValue(createMockRow({ role: UserRole.STAFF, widgets }));

      const result = await createService(repo).upsertDefault(UserRole.STAFF, { widgets });

      expect(repo.upsert).toHaveBeenCalledWith(TENANT_ID, UserRole.STAFF, widgets, ADMIN_USER_ID);
      expect(result.role).toBe(UserRole.STAFF);
      expect(result.widgets).toEqual(widgets);
    });
  });

  describe('deleteDefault', () => {
    it('deletes scoped to tenant + role', async () => {
      const repo = createMockRepository();

      await createService(repo).deleteDefault(UserRole.STAFF);

      expect(repo.deleteByTenantAndRole).toHaveBeenCalledWith(TENANT_ID, UserRole.STAFF);
    });
  });
});
