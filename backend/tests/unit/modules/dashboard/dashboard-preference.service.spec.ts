import { Request } from 'express';
import { DashboardPreference } from '@prisma/client';

/** See the identical comment in tests/unit/modules/documents/document.service.spec.ts for why @config/database is stubbed. */
jest.mock('@config/database', () => ({ prisma: {} }));

import { UserRole } from '@shared/enums';
import { DashboardPreferenceService } from '@modules/dashboard/service/dashboard-preference.service';
import { DashboardPreferenceRepository } from '@modules/dashboard/repository/dashboard-preference.repository';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DashboardPreferenceService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * The repository is fully mocked, injected via constructor DI — mirrors
 * `tests/unit/modules/tenant/tenant-branding.service.spec.ts` exactly.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';
const OTHER_USER_ID = 'user-33333333-3333-3333-3333-333333333333';

type MockedRepository = { [K in 'findByUserId' | 'upsert']: jest.Mock };

function createMockRepository(): MockedRepository {
  return { findByUserId: jest.fn(), upsert: jest.fn() };
}

function createFakeRequest(userId: string = USER_ID): Request {
  return {
    tenant: { id: TENANT_ID, slug: 'acme', name: 'Acme & Co', planCode: 'professional', isActive: true },
    user: { id: userId, email: 'staff@acme.test', role: UserRole.TENANT_ADMIN, tenantId: TENANT_ID, permissions: [] },
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
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  } as DashboardPreference;
}

function createService(repo: MockedRepository, req: Request = createFakeRequest()): DashboardPreferenceService {
  return new DashboardPreferenceService(req, repo as unknown as DashboardPreferenceRepository);
}

describe('DashboardPreferenceService', () => {
  describe('getPreferences', () => {
    it('returns an empty widgets array and null updatedAt when no row exists yet (first-time user)', async () => {
      const repo = createMockRepository();
      repo.findByUserId.mockResolvedValue(null);

      const result = await createService(repo).getPreferences();

      expect(repo.findByUserId).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual({ widgets: [], updatedAt: null });
    });

    it('maps the saved widgets array and updatedAt when a row exists', async () => {
      const repo = createMockRepository();
      repo.findByUserId.mockResolvedValue(createMockPreference());

      const result = await createService(repo).getPreferences();

      expect(result.widgets).toEqual([
        { widgetId: 'kpi-stats', visible: true },
        { widgetId: 'task-summary', visible: false },
      ]);
      expect(result.updatedAt).toBe('2026-01-02T00:00:00.000Z');
    });

    it("a different caller's userId scopes the lookup to their own id", async () => {
      const repo = createMockRepository();
      repo.findByUserId.mockResolvedValue(null);

      await createService(repo, createFakeRequest(OTHER_USER_ID)).getPreferences();

      expect(repo.findByUserId).toHaveBeenCalledWith(OTHER_USER_ID);
    });
  });

  describe('updatePreferences', () => {
    it('upserts scoped to the caller tenant + user and returns the saved layout', async () => {
      const repo = createMockRepository();
      const widgets = [{ widgetId: 'recent-documents', visible: true }];
      repo.upsert.mockResolvedValue(createMockPreference({ widgets }));

      const result = await createService(repo).updatePreferences({ widgets });

      expect(repo.upsert).toHaveBeenCalledWith(TENANT_ID, USER_ID, widgets);
      expect(result.widgets).toEqual(widgets);
    });

    it('accepts an empty widgets array (clears the layout)', async () => {
      const repo = createMockRepository();
      repo.upsert.mockResolvedValue(createMockPreference({ widgets: [] }));

      const result = await createService(repo).updatePreferences({ widgets: [] });

      expect(repo.upsert).toHaveBeenCalledWith(TENANT_ID, USER_ID, []);
      expect(result.widgets).toEqual([]);
    });
  });
});
