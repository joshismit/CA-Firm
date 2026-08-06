import { Application } from 'express';
import request from 'supertest';
import { prisma } from '@config/database';
import { UserRole } from '@shared/enums';
import { TaskStatus } from '@prisma/client';
import { createDashboardTestApp } from '../../helpers/dashboard-test-app';
import { signAccessToken } from '../../helpers/jwt';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Dashboard Aggregation API — Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the full real request lifecycle against a real database:
 *   Request → authMiddleware (JWT) → tenantMiddleware → requireRole →
 *   validate (Zod) → DashboardController → DashboardAggregationService →
 *   real module Services → Postgres.
 *
 * NOTE (environment limitation, not a code defect): this suite requires a
 * live Postgres instance and could not be executed in the sandboxed
 * environment this feature was implemented in (no local Postgres/Docker
 * reachable) — run it against a real dev database before relying on it.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

describe('Dashboard Aggregation API — integration', () => {
  let app: Application;
  let fixtures: TestFixtures;
  let taskId: string;

  beforeAll(async () => {
    app = createDashboardTestApp();
    fixtures = await seedFixtures(prisma);

    const task = await prisma.task.create({
      data: {
        tenantId: fixtures.tenantA.tenantId,
        title: 'File GST return',
        assigneeId: fixtures.tenantA.userId,
        status: TaskStatus.TODO,
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      },
    });
    taskId = task.id;
  });

  afterAll(async () => {
    await prisma.task.deleteMany({ where: { id: taskId } });
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  function tokenFor(userId: string, tenantId: string, role: UserRole): string {
    return signAccessToken({ userId, tenantId, role, permissions: [] });
  }

  describe('authentication and role gating', () => {
    it('returns 401 when no Authorization header is present', async () => {
      const res = await request(app).get('/api/v1/dashboard');
      expect(res.status).toBe(401);
    });

    it('TENANT_ADMIN/MANAGER/STAFF can all reach the dashboard', async () => {
      for (const role of [UserRole.TENANT_ADMIN, UserRole.MANAGER, UserRole.STAFF]) {
        const res = await request(app)
          .get('/api/v1/dashboard')
          .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.userId, fixtures.tenantA.tenantId, role)}`);
        expect(res.status).toBe(200);
      }
    });

    it('CLIENT role is rejected with 403 (no client-portal dashboard exists)', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.userId, fixtures.tenantA.tenantId, UserRole.CLIENT)}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /dashboard', () => {
    it('returns the counts-only overview shape', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.userId, fixtures.tenantA.tenantId, UserRole.TENANT_ADMIN)}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        pendingWorksCount: expect.any(Number),
        dueDatesCount: expect.any(Number),
        outstandingPaymentsTotal: expect.any(Number),
      });
    });
  });

  describe('GET /dashboard/widgets', () => {
    it('returns only the requested widget ids, scoped to STAFF assigneeId', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/widgets?ids=pending-works,due-dates&limit=5')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.userId, fixtures.tenantA.tenantId, UserRole.STAFF)}`);

      expect(res.status).toBe(200);
      expect(Object.keys(res.body.data).sort()).toEqual(['due-dates', 'pending-works']);
      expect(res.body.data['pending-works'].items.some((item: { id: string }) => item.id === taskId)).toBe(true);
    });

    it('returns 422 for an unknown widget id', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/widgets?ids=not-a-real-widget')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.userId, fixtures.tenantA.tenantId, UserRole.TENANT_ADMIN)}`);
      expect(res.status).toBe(422);
    });
  });

  describe('GET /dashboard/calendar', () => {
    it('includes the seeded task as a calendar entry within range', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/calendar')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.userId, fixtures.tenantA.tenantId, UserRole.TENANT_ADMIN)}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.some((item: { id: string; type: string }) => item.id === taskId && item.type === 'task')).toBe(true);
    });
  });

  describe('GET /dashboard/activity', () => {
    it('returns the shape { items: [] } even with no audit history yet', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/activity')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.userId, fixtures.tenantA.tenantId, UserRole.TENANT_ADMIN)}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });
  });

  describe('GET /dashboard/performance', () => {
    it('includes staffBreakdown for TENANT_ADMIN, omits it (null) for STAFF', async () => {
      const adminRes = await request(app)
        .get('/api/v1/dashboard/performance')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.userId, fixtures.tenantA.tenantId, UserRole.TENANT_ADMIN)}`);
      expect(adminRes.status).toBe(200);
      expect(adminRes.body.data.staffBreakdown).not.toBeNull();

      const staffRes = await request(app)
        .get('/api/v1/dashboard/performance')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.userId, fixtures.tenantA.tenantId, UserRole.STAFF)}`);
      expect(staffRes.status).toBe(200);
      expect(staffRes.body.data.staffBreakdown).toBeNull();
    });
  });

  describe('tenant isolation', () => {
    it("tenant B's dashboard never reflects tenant A's seeded task", async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/widgets?ids=pending-works')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantB.userId, fixtures.tenantB.tenantId, UserRole.TENANT_ADMIN)}`);

      expect(res.status).toBe(200);
      expect(res.body.data['pending-works'].items.some((item: { id: string }) => item.id === taskId)).toBe(false);
    });
  });
});
