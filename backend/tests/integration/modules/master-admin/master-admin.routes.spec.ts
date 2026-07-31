import bcrypt from 'bcryptjs';
import request from 'supertest';
import { Application } from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '@config/database';
import { UserRole } from '@shared/enums';
import { createMasterAdminTestApp } from '../../helpers/master-admin-test-app';
import { signAccessToken } from '../../helpers/jwt';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Master Admin API — Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the full real request lifecycle against a real database:
 *   Request → authMiddleware (JWT) → requireRole(MASTER_ADMIN) → validate
 *   (Zod) → controller → service → repository → Postgres
 *
 * Creates a real `MasterAdmin` row directly via Prisma (there is no signup
 * endpoint — see the model's header comment in schema.prisma) and reuses
 * `seedFixtures`'s real tenant to exercise the tenant-management endpoints.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

const TEST_PASSWORD = 'MasterAdminP@ss9!';

describe('Master Admin API — integration', () => {
  let app: Application;
  let fixtures: TestFixtures;
  let adminId: string;
  let adminEmail: string;

  beforeAll(async () => {
    app = createMasterAdminTestApp();
    fixtures = await seedFixtures(prisma);

    adminEmail = `master.admin.${randomUUID().slice(0, 8)}@example.test`;
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const admin = await prisma.masterAdmin.create({
      data: { email: adminEmail, passwordHash, firstName: 'Master', lastName: 'Admin' },
    });
    adminId = admin.id;
  });

  afterAll(async () => {
    await prisma.masterAdmin.delete({ where: { id: adminId } });
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  function masterAdminToken(): string {
    return signAccessToken({ userId: adminId, email: adminEmail, role: UserRole.MASTER_ADMIN, permissions: [] });
  }

  function tenantUserToken(): string {
    return signAccessToken({ userId: fixtures.tenantA.userId, tenantId: fixtures.tenantA.tenantId, role: UserRole.TENANT_ADMIN });
  }

  // ────────────────────────────────────────────────────────────────────────
  // POST /master-admin/auth/login
  // ────────────────────────────────────────────────────────────────────────
  describe('POST /master-admin/auth/login', () => {
    it('returns 401 for an unknown email', async () => {
      const res = await request(app)
        .post('/api/v1/master-admin/auth/login')
        .send({ email: 'nobody@nowhere.test', password: TEST_PASSWORD });
      expect(res.status).toBe(401);
    });

    it('returns 401 for a known email with the wrong password', async () => {
      const res = await request(app)
        .post('/api/v1/master-admin/auth/login')
        .send({ email: adminEmail, password: 'WrongPassword123!' });
      expect(res.status).toBe(401);
    });

    it('returns 422 when the body fails validation', async () => {
      const res = await request(app).post('/api/v1/master-admin/auth/login').send({ email: 'not-an-email' });
      expect(res.status).toBe(422);
    });

    it('returns 403 for a deactivated admin account', async () => {
      const deactivatedEmail = `inactive.${randomUUID().slice(0, 8)}@example.test`;
      const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
      const inactive = await prisma.masterAdmin.create({
        data: { email: deactivatedEmail, passwordHash, firstName: 'Inactive', lastName: 'Admin', isActive: false },
      });

      const res = await request(app)
        .post('/api/v1/master-admin/auth/login')
        .send({ email: deactivatedEmail, password: TEST_PASSWORD });
      expect(res.status).toBe(403);

      await prisma.masterAdmin.delete({ where: { id: inactive.id } });
    });

    it('returns 200 with a real access token and the admin profile on correct credentials', async () => {
      const res = await request(app)
        .post('/api/v1/master-admin/auth/login')
        .send({ email: adminEmail, password: TEST_PASSWORD });

      expect(res.status).toBe(200);
      expect(typeof res.body.data.accessToken).toBe('string');
      expect(res.body.data.admin).toMatchObject({ id: adminId, email: adminEmail });
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Auth / role gating
  // ────────────────────────────────────────────────────────────────────────
  describe('access control', () => {
    it('returns 401 with no Authorization header', async () => {
      const res = await request(app).get('/api/v1/master-admin/tenants');
      expect(res.status).toBe(401);
    });

    it('returns 403 for a valid but non-MASTER_ADMIN token (a regular tenant user)', async () => {
      const res = await request(app)
        .get('/api/v1/master-admin/tenants')
        .set('Authorization', `Bearer ${tenantUserToken()}`);
      expect(res.status).toBe(403);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Tenants
  // ────────────────────────────────────────────────────────────────────────
  describe('GET /master-admin/tenants', () => {
    it('returns 200 and includes the seeded tenant, scoped across every tenant (not just one)', async () => {
      const res = await request(app)
        .get('/api/v1/master-admin/tenants')
        .set('Authorization', `Bearer ${masterAdminToken()}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((t: { id: string }) => t.id);
      expect(ids).toContain(fixtures.tenantA.tenantId);
      expect(ids).toContain(fixtures.tenantB.tenantId);
    });

    it('filters by search against tenant name', async () => {
      const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: fixtures.tenantA.tenantId } });
      const res = await request(app)
        .get('/api/v1/master-admin/tenants')
        .query({ search: tenant.name })
        .set('Authorization', `Bearer ${masterAdminToken()}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((t: { id: string }) => t.id);
      expect(ids).toContain(fixtures.tenantA.tenantId);
      expect(ids).not.toContain(fixtures.tenantB.tenantId);
    });
  });

  describe('tenant detail + status + limits lifecycle', () => {
    it('GET /master-admin/tenants/:id returns 200 with usage stats', async () => {
      const res = await request(app)
        .get(`/api/v1/master-admin/tenants/${fixtures.tenantA.tenantId}`)
        .set('Authorization', `Bearer ${masterAdminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(fixtures.tenantA.tenantId);
      expect(res.body.data.usage).toMatchObject({
        userCount: expect.any(Number),
        businessCount: expect.any(Number),
        clientCount: expect.any(Number),
        documentCount: expect.any(Number),
        storageUsedBytes: expect.any(Number),
      });
    });

    it('GET /master-admin/tenants/:id returns 404 for a well-formed but unknown id', async () => {
      const res = await request(app)
        .get(`/api/v1/master-admin/tenants/${randomUUID()}`)
        .set('Authorization', `Bearer ${masterAdminToken()}`);
      expect(res.status).toBe(404);
    });

    it('PATCH /master-admin/tenants/:id/status suspends then reactivates the tenant', async () => {
      const suspend = await request(app)
        .patch(`/api/v1/master-admin/tenants/${fixtures.tenantA.tenantId}/status`)
        .set('Authorization', `Bearer ${masterAdminToken()}`)
        .send({ status: 'SUSPENDED' });
      expect(suspend.status).toBe(200);
      expect(suspend.body.data.status).toBe('SUSPENDED');

      const reactivate = await request(app)
        .patch(`/api/v1/master-admin/tenants/${fixtures.tenantA.tenantId}/status`)
        .set('Authorization', `Bearer ${masterAdminToken()}`)
        .send({ status: 'ACTIVE' });
      expect(reactivate.status).toBe(200);
      expect(reactivate.body.data.status).toBe('ACTIVE');
    });

    it('PATCH /master-admin/tenants/:id/status returns 422 for an invalid status value', async () => {
      const res = await request(app)
        .patch(`/api/v1/master-admin/tenants/${fixtures.tenantA.tenantId}/status`)
        .set('Authorization', `Bearer ${masterAdminToken()}`)
        .send({ status: 'NOT_A_REAL_STATUS' });
      expect(res.status).toBe(422);
    });

    it('PATCH /master-admin/tenants/:id/limits updates plan code and max users', async () => {
      const res = await request(app)
        .patch(`/api/v1/master-admin/tenants/${fixtures.tenantA.tenantId}/limits`)
        .set('Authorization', `Bearer ${masterAdminToken()}`)
        .send({ planCode: 'enterprise', maxUsers: 100 });

      expect(res.status).toBe(200);
      expect(res.body.data.planCode).toBe('enterprise');
      expect(res.body.data.maxUsers).toBe(100);
    });

    it('PATCH /master-admin/tenants/:id/limits returns 404 for a well-formed but unknown id', async () => {
      const res = await request(app)
        .patch(`/api/v1/master-admin/tenants/${randomUUID()}/limits`)
        .set('Authorization', `Bearer ${masterAdminToken()}`)
        .send({ maxUsers: 10 });
      expect(res.status).toBe(404);
    });
  });
});
