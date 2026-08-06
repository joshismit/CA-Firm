import { randomUUID } from 'crypto';
import request from 'supertest';
import { Application } from 'express';
import { prisma } from '@config/database';
import { UserRole } from '@shared/enums';
import { createDashboardPreferenceTestApp } from '../../helpers/dashboard-preference-test-app';
import { signAccessToken } from '../../helpers/jwt';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Dashboard Preferences API — Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the full real request lifecycle against a real database:
 *   Request → authMiddleware (JWT) → tenantMiddleware → validate (Zod) →
 *   DashboardPreferenceController → DashboardPreferenceService →
 *   DashboardPreferenceRepository → Postgres.
 *
 * There is no separate "create" endpoint — PATCH upserts, same as
 * `modules/tenant`'s branding suite.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

describe('Dashboard Preferences API — integration', () => {
  let app: Application;
  let fixtures: TestFixtures;

  beforeAll(async () => {
    app = createDashboardPreferenceTestApp();
    fixtures = await seedFixtures(prisma);
  });

  afterAll(async () => {
    await prisma.dashboardPreference.deleteMany({
      where: { tenantId: { in: [fixtures.tenantA.tenantId, fixtures.tenantB.tenantId] } },
    });
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  function tokenForTenantA(permissions: string[] = []): string {
    return signAccessToken({ userId: fixtures.tenantA.userId, tenantId: fixtures.tenantA.tenantId, permissions });
  }

  function tokenForTenantB(): string {
    return signAccessToken({ userId: fixtures.tenantB.userId, tenantId: fixtures.tenantB.tenantId, permissions: [] });
  }

  describe('authentication middleware and no permission gating', () => {
    it('returns 401 when no Authorization header is present', async () => {
      const res = await request(app).get('/api/v1/dashboard/preferences');
      expect(res.status).toBe(401);
    });

    it('succeeds on GET for a token with zero permissions (self-service, ungated)', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/preferences')
        .set('Authorization', `Bearer ${tokenForTenantA([])}`);
      expect(res.status).toBe(200);
    });
  });

  describe('first-time user (no row yet)', () => {
    it('GET returns an empty widgets array and null updatedAt — not a 404', async () => {
      const res = await request(app).get('/api/v1/dashboard/preferences').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ widgets: [], updatedAt: null, source: 'registry', refreshIntervalSeconds: null });
    });
  });

  describe('validation middleware', () => {
    it('returns 422 when widgets is missing', async () => {
      const res = await request(app).patch('/api/v1/dashboard/preferences').set('Authorization', `Bearer ${tokenForTenantA()}`).send({});
      expect(res.status).toBe(422);
    });

    it('returns 422 when a widget entry is missing visible', async () => {
      const res = await request(app)
        .patch('/api/v1/dashboard/preferences')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ widgets: [{ widgetId: 'task-summary' }] });
      expect(res.status).toBe(422);
    });

    it('returns 422 when widgetId exceeds the max length', async () => {
      const res = await request(app)
        .patch('/api/v1/dashboard/preferences')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ widgets: [{ widgetId: 'x'.repeat(61), visible: true }] });
      expect(res.status).toBe(422);
    });
  });

  describe('create + update (upsert)', () => {
    it('PATCH creates the row on first write and returns the saved layout in order', async () => {
      const payload = {
        widgets: [
          { widgetId: 'kpi-stats', visible: true },
          { widgetId: 'task-summary', visible: false },
          { widgetId: 'recent-documents', visible: true },
        ],
      };

      const res = await request(app).patch('/api/v1/dashboard/preferences').set('Authorization', `Bearer ${tokenForTenantA()}`).send(payload);
      expect(res.status).toBe(200);
      expect(res.body.data.widgets).toEqual(payload.widgets);
      expect(res.body.data.updatedAt).not.toBeNull();

      const row = await prisma.dashboardPreference.findUniqueOrThrow({ where: { userId: fixtures.tenantA.userId } });
      expect(row.tenantId).toBe(fixtures.tenantA.tenantId);
      expect(row.widgets).toEqual(payload.widgets);
    });

    it('a subsequent GET reflects the saved layout', async () => {
      const res = await request(app).get('/api/v1/dashboard/preferences').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      expect(res.body.data.widgets).toEqual([
        { widgetId: 'kpi-stats', visible: true },
        { widgetId: 'task-summary', visible: false },
        { widgetId: 'recent-documents', visible: true },
      ]);
    });

    it('PATCH again fully replaces (not merges) the previous layout, including reordering', async () => {
      const payload = { widgets: [{ widgetId: 'recent-documents', visible: true }, { widgetId: 'kpi-stats', visible: false }] };

      const res = await request(app).patch('/api/v1/dashboard/preferences').set('Authorization', `Bearer ${tokenForTenantA()}`).send(payload);
      expect(res.status).toBe(200);
      expect(res.body.data.widgets).toEqual(payload.widgets);
      expect(res.body.data.widgets.map((w: { widgetId: string }) => w.widgetId)).not.toContain('task-summary');
    });

    it('PATCH with an empty widgets array is accepted and clears the layout', async () => {
      const res = await request(app).patch('/api/v1/dashboard/preferences').set('Authorization', `Bearer ${tokenForTenantA()}`).send({ widgets: [] });
      expect(res.status).toBe(200);
      expect(res.body.data.widgets).toEqual([]);
    });
  });

  describe('tenant isolation', () => {
    it("does not leak tenant A's preferences into tenant B's GET", async () => {
      await request(app)
        .patch('/api/v1/dashboard/preferences')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ widgets: [{ widgetId: 'kpi-stats', visible: true }] });

      const res = await request(app).get('/api/v1/dashboard/preferences').set('Authorization', `Bearer ${tokenForTenantB()}`);
      expect(res.status).toBe(200);
      expect(res.body.data.widgets).toEqual([]);
    });

    it("tenant B's own PATCH does not affect tenant A's row", async () => {
      await request(app)
        .patch('/api/v1/dashboard/preferences')
        .set('Authorization', `Bearer ${tokenForTenantB()}`)
        .send({ widgets: [{ widgetId: 'notifications-preview', visible: false }] });

      const tenantARow = await prisma.dashboardPreference.findUniqueOrThrow({ where: { userId: fixtures.tenantA.userId } });
      expect(tenantARow.widgets).not.toEqual([{ widgetId: 'notifications-preview', visible: false }]);

      const tenantBRow = await prisma.dashboardPreference.findUniqueOrThrow({ where: { userId: fixtures.tenantB.userId } });
      expect(tenantBRow.tenantId).toBe(fixtures.tenantB.tenantId);
      expect(tenantBRow.widgets).toEqual([{ widgetId: 'notifications-preview', visible: false }]);
    });
  });

  describe('PATCH — extended layout fields (PRD §10.2/§10.4)', () => {
    it('persists size/collapsed/pinned per widget and refreshIntervalSeconds, round-tripped on GET', async () => {
      const payload = {
        widgets: [{ widgetId: 'kpi-stats', visible: true, size: 'half', collapsed: true, pinned: true }],
        refreshIntervalSeconds: 120,
      };

      const patchRes = await request(app).patch('/api/v1/dashboard/preferences').set('Authorization', `Bearer ${tokenForTenantA()}`).send(payload);
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.widgets).toEqual(payload.widgets);
      expect(patchRes.body.data.refreshIntervalSeconds).toBe(120);
      expect(patchRes.body.data.source).toBe('personal');

      const getRes = await request(app).get('/api/v1/dashboard/preferences').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(getRes.body.data.widgets).toEqual(payload.widgets);
      expect(getRes.body.data.refreshIntervalSeconds).toBe(120);
    });
  });

  describe('POST /reset — restore defaults (PRD §10.4) + tenant/role default fallback (PRD §10.3)', () => {
    afterEach(async () => {
      await prisma.dashboardTenantDefault.deleteMany({ where: { tenantId: fixtures.tenantA.tenantId } });
    });

    it('deletes the personal row; a user with no tenant default falls back to the empty registry shape', async () => {
      await request(app)
        .patch('/api/v1/dashboard/preferences')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ widgets: [{ widgetId: 'kpi-stats', visible: true }] });

      const resetRes = await request(app).post('/api/v1/dashboard/preferences/reset').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(resetRes.status).toBe(200);
      expect(resetRes.body.data.source).toBe('registry');
      expect(resetRes.body.data.widgets).toEqual([]);

      const row = await prisma.dashboardPreference.findUnique({ where: { userId: fixtures.tenantA.userId } });
      expect(row).toBeNull();
    });

    it('a user with no personal row inherits their tenant admin-configured role default', async () => {
      await prisma.dashboardTenantDefault.create({
        data: {
          tenantId: fixtures.tenantA.tenantId,
          role: UserRole.TENANT_ADMIN,
          widgets: [{ widgetId: 'task-summary', visible: true }],
          updatedBy: fixtures.tenantA.userId,
        },
      });

      const res = await request(app).get('/api/v1/dashboard/preferences').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      expect(res.body.data.source).toBe('tenant-default');
      expect(res.body.data.widgets).toEqual([{ widgetId: 'task-summary', visible: true }]);
    });

    it('a saved personal row always wins over a tenant default', async () => {
      await prisma.dashboardTenantDefault.create({
        data: {
          tenantId: fixtures.tenantA.tenantId,
          role: UserRole.TENANT_ADMIN,
          widgets: [{ widgetId: 'task-summary', visible: true }],
          updatedBy: fixtures.tenantA.userId,
        },
      });
      await request(app)
        .patch('/api/v1/dashboard/preferences')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ widgets: [{ widgetId: 'kpi-stats', visible: true }] });

      const res = await request(app).get('/api/v1/dashboard/preferences').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.body.data.source).toBe('personal');
      expect(res.body.data.widgets).toEqual([{ widgetId: 'kpi-stats', visible: true }]);
    });
  });
});
