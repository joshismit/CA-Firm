import { randomUUID } from 'crypto';
import request from 'supertest';
import { Application } from 'express';
import { prisma } from '@config/database';
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
      expect(res.body.data).toEqual({ widgets: [], updatedAt: null });
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
});
