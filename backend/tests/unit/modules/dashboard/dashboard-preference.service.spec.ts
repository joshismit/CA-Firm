import { Request } from 'express';
import { DashboardPreference, DashboardTenantDefault } from '@prisma/client';

/** See the identical comment in tests/unit/modules/documents/document.service.spec.ts for why @config/database is stubbed. */
jest.mock('@config/database', () => ({ prisma: {} }));

import { UserRole } from '@shared/enums';
import { DashboardPreferenceService } from '@modules/dashboard/service/dashboard-preference.service';
import { DashboardPreferenceRepository } from '@modules/dashboard/repository/dashboard-preference.repository';
import { DashboardTenantDefaultRepository } from '@modules/dashboard/repository/dashboard-tenant-default.repository';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DashboardPreferenceService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Both repositories are fully mocked, injected via constructor DI — mirrors
 * `tests/unit/modules/tenant/tenant-branding.service.spec.ts` exactly.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';
const OTHER_USER_ID = 'user-33333333-3333-3333-3333-333333333333';

type MockedPreferenceRepository = { [K in 'findByUserId' | 'upsert' | 'deleteByUserId']: jest.Mock };
type MockedTenantDefaultRepository = { [K in 'findByTenantAndRole']: jest.Mock };

function createMockRepository(): MockedPreferenceRepository {
  return { findByUserId: jest.fn(), upsert: jest.fn(), deleteByUserId: jest.fn() };
}

function createMockTenantDefaultRepository(): MockedTenantDefaultRepository {
  return { findByTenantAndRole: jest.fn().mockResolvedValue(null) };
}

function createFakeRequest(userId: string = USER_ID, role: UserRole = UserRole.TENANT_ADMIN): Request {
  return {
    tenant: { id: TENANT_ID, slug: 'acme', name: 'Acme & Co', planCode: 'professional', isActive: true },
    user: { id: userId, email: 'staff@acme.test', role, tenantId: TENANT_ID, permissions: [] },
    correlationId: 'test-correlation-id',
  } as unknown as Request;
}

function createMockPreference(overrides: Partial<DashboardPreference> = {}): DashboardPreference {
  return {
    id: 'pref-id',
    tenantId: TENANT_ID,
    userId: USER_ID,
    widgets: [
      { widgetId: 'kpi-stats', visible: true },
      { widgetId: 'task-summary', visible: false },
    ],
    refreshIntervalSeconds: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  } as DashboardPreference;
}

function createMockTenantDefault(overrides: Partial<DashboardTenantDefault> = {}): DashboardTenantDefault {
  return {
    id: 'default-id',
    tenantId: TENANT_ID,
    role: UserRole.STAFF,
    widgets: [{ widgetId: 'task-summary', visible: true }],
    updatedBy: 'admin-id',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-03T00:00:00.000Z'),
    ...overrides,
  } as DashboardTenantDefault;
}

function createService(
  repo: MockedPreferenceRepository,
  req: Request = createFakeRequest(),
  tenantDefaultRepo: MockedTenantDefaultRepository = createMockTenantDefaultRepository(),
): DashboardPreferenceService {
  return new DashboardPreferenceService(
    req,
    repo as unknown as DashboardPreferenceRepository,
    tenantDefaultRepo as unknown as DashboardTenantDefaultRepository,
  );
}

describe('DashboardPreferenceService', () => {
  describe('getPreferences', () => {
    it('returns the personal row (source: personal) when one exists, without consulting the tenant default', async () => {
      const repo = createMockRepository();
      repo.findByUserId.mockResolvedValue(createMockPreference());
      const tenantDefaultRepo = createMockTenantDefaultRepository();

      const result = await createService(repo, createFakeRequest(), tenantDefaultRepo).getPreferences();

      expect(result.widgets).toEqual([
        { widgetId: 'kpi-stats', visible: true },
        { widgetId: 'task-summary', visible: false },
      ]);
      expect(result.updatedAt).toBe('2026-01-02T00:00:00.000Z');
      expect(result.source).toBe('personal');
      expect(tenantDefaultRepo.findByTenantAndRole).not.toHaveBeenCalled();
    });

    it('falls back to the tenant/role default (source: tenant-default) when no personal row exists', async () => {
      const repo = createMockRepository();
      repo.findByUserId.mockResolvedValue(null);
      const tenantDefaultRepo = createMockTenantDefaultRepository();
      tenantDefaultRepo.findByTenantAndRole.mockResolvedValue(createMockTenantDefault({ role: UserRole.TENANT_ADMIN }));

      const result = await createService(repo, createFakeRequest(USER_ID, UserRole.TENANT_ADMIN), tenantDefaultRepo).getPreferences();

      expect(tenantDefaultRepo.findByTenantAndRole).toHaveBeenCalledWith(TENANT_ID, UserRole.TENANT_ADMIN);
      expect(result.source).toBe('tenant-default');
      expect(result.widgets).toEqual([{ widgetId: 'task-summary', visible: true }]);
    });

    it('falls back to the empty registry-default shape when neither a personal row nor a tenant default exists', async () => {
      const repo = createMockRepository();
      repo.findByUserId.mockResolvedValue(null);

      const result = await createService(repo).getPreferences();

      expect(repo.findByUserId).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual({ widgets: [], updatedAt: null, source: 'registry', refreshIntervalSeconds: null });
    });

    it("a different caller's userId scopes the lookup to their own id", async () => {
      const repo = createMockRepository();
      repo.findByUserId.mockResolvedValue(null);

      await createService(repo, createFakeRequest(OTHER_USER_ID)).getPreferences();

      expect(repo.findByUserId).toHaveBeenCalledWith(OTHER_USER_ID);
    });
  });

  describe('updatePreferences', () => {
    it('upserts scoped to the caller tenant + user, including the refresh interval, and returns the saved layout', async () => {
      const repo = createMockRepository();
      const widgets = [{ widgetId: 'recent-documents', visible: true }];
      repo.upsert.mockResolvedValue(createMockPreference({ widgets, refreshIntervalSeconds: 300 }));

      const result = await createService(repo).updatePreferences({ widgets, refreshIntervalSeconds: 300 });

      expect(repo.upsert).toHaveBeenCalledWith(TENANT_ID, USER_ID, widgets, 300);
      expect(result.widgets).toEqual(widgets);
      expect(result.refreshIntervalSeconds).toBe(300);
    });

    it('accepts an empty widgets array (clears the layout)', async () => {
      const repo = createMockRepository();
      repo.upsert.mockResolvedValue(createMockPreference({ widgets: [] }));

      const result = await createService(repo).updatePreferences({ widgets: [] });

      expect(repo.upsert).toHaveBeenCalledWith(TENANT_ID, USER_ID, [], undefined);
      expect(result.widgets).toEqual([]);
    });
  });

  describe('resetPreferences', () => {
    it('deletes the personal row, then re-resolves via the normal fallback chain', async () => {
      const repo = createMockRepository();
      repo.deleteByUserId.mockResolvedValue(true);
      repo.findByUserId.mockResolvedValue(null);
      const tenantDefaultRepo = createMockTenantDefaultRepository();
      tenantDefaultRepo.findByTenantAndRole.mockResolvedValue(createMockTenantDefault());

      const result = await createService(repo, createFakeRequest(), tenantDefaultRepo).resetPreferences();

      expect(repo.deleteByUserId).toHaveBeenCalledWith(USER_ID);
      expect(result.source).toBe('tenant-default');
    });
  });
});
