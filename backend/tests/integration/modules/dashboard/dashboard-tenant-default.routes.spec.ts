import { Application } from 'express';
import request from 'supertest';
import { prisma } from '@config/database';
import { UserRole } from '@shared/enums';
import { createDashboardTestApp } from '../../helpers/dashboard-test-app';
import { signAccessToken } from '../../helpers/jwt';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Dashboard Tenant Default API — Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * NOTE (environment limitation, not a code defect): requires a live Postgres
 * instance — could not be executed in the sandboxed environment this feature
 * was implemented in. Run against a real dev database before relying on it.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

describe('Dashboard Tenant Default API — integration', () => {
  let app: Application;
  let fixtures: TestFixtures;

  beforeAll(async () => {
    app = createDashboardTestApp();
    fixtures = await seedFixtures(prisma);
  });

  afterAll(async () => {
    await prisma.dashboardTenantDefault.deleteMany({
      where: { tenantId: { in: [fixtures.tenantA.tenantId, fixtures.tenantB.tenantId] } },
    });
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  function tokenFor(userId: string, tenantId: string, role: UserRole): string {
    return signAccessToken({ userId, tenantId, role, permissions: [] });
  }

  describe('role gating', () => {
    it('STAFF and MANAGER get 403 — only TENANT_ADMIN may configure tenant defaults', async () => {
      for (const role of [UserRole.STAFF, UserRole.MANAGER]) {
        const res = await request(app)
          .get('/api/v1/dashboard/tenant-defaults')
          .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.userId, fixtures.tenantA.tenantId, role)}`);
        expect(res.status).toBe(403);
      }
    });

    it('TENANT_ADMIN can list defaults', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/tenant-defaults')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.userId, fixtures.tenantA.tenantId, UserRole.TENANT_ADMIN)}`);
      expect(res.status).toBe(200);
      expect(res.body.data.map((row: { role: string }) => row.role).sort()).toEqual(Object.values(UserRole).sort());
    });
  });

  describe('validation', () => {
    it('returns 422 for an invalid :role param', async () => {
      const res = await request(app)
        .put('/api/v1/dashboard/tenant-defaults/NOT_A_ROLE')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.userId, fixtures.tenantA.tenantId, UserRole.TENANT_ADMIN)}`)
        .send({ widgets: [] });
      expect(res.status).toBe(422);
    });

    it('returns 422 when widgets is missing', async () => {
      const res = await request(app)
        .put('/api/v1/dashboard/tenant-defaults/STAFF')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.userId, fixtures.tenantA.tenantId, UserRole.TENANT_ADMIN)}`)
        .send({});
      expect(res.status).toBe(422);
    });
  });

  describe('upsert + delete', () => {
    it('PUT saves a default layout for STAFF, reflected in a subsequent GET', async () => {
      const widgets = [{ widgetId: 'task-summary', visible: true }];
      const putRes = await request(app)
        .put('/api/v1/dashboard/tenant-defaults/STAFF')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.userId, fixtures.tenantA.tenantId, UserRole.TENANT_ADMIN)}`)
        .send({ widgets });
      expect(putRes.status).toBe(200);
      expect(putRes.body.data.widgets).toEqual(widgets);

      const getRes = await request(app)
        .get('/api/v1/dashboard/tenant-defaults')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.userId, fixtures.tenantA.tenantId, UserRole.TENANT_ADMIN)}`);
      const staffEntry = getRes.body.data.find((row: { role: string }) => row.role === 'STAFF');
      expect(staffEntry.widgets).toEqual(widgets);
    });

    it('DELETE removes the configured default', async () => {
      const delRes = await request(app)
        .delete('/api/v1/dashboard/tenant-defaults/STAFF')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.userId, fixtures.tenantA.tenantId, UserRole.TENANT_ADMIN)}`);
      expect(delRes.status).toBe(200);

      const getRes = await request(app)
        .get('/api/v1/dashboard/tenant-defaults')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.userId, fixtures.tenantA.tenantId, UserRole.TENANT_ADMIN)}`);
      const staffEntry = getRes.body.data.find((row: { role: string }) => row.role === 'STAFF');
      expect(staffEntry.widgets).toEqual([]);
      expect(staffEntry.updatedAt).toBeNull();
    });
  });

  describe('tenant isolation', () => {
    it("tenant B never sees tenant A's configured STAFF default", async () => {
      await request(app)
        .put('/api/v1/dashboard/tenant-defaults/STAFF')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.userId, fixtures.tenantA.tenantId, UserRole.TENANT_ADMIN)}`)
        .send({ widgets: [{ widgetId: 'kpi-stats', visible: true }] });

      const res = await request(app)
        .get('/api/v1/dashboard/tenant-defaults')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantB.userId, fixtures.tenantB.tenantId, UserRole.TENANT_ADMIN)}`);
      const staffEntry = res.body.data.find((row: { role: string }) => row.role === 'STAFF');
      expect(staffEntry.widgets).toEqual([]);
    });
  });
});
