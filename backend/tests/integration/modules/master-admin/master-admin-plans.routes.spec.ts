import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { Application } from 'express';
import { BillingCycle } from '@prisma/client';
import { prisma } from '@config/database';
import { UserRole } from '@shared/enums';
import { createMasterAdminTestApp } from '../../helpers/master-admin-test-app';
import { signAccessToken } from '../../helpers/jwt';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Master Admin — Plan Management API — Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises `/master-admin/plans*`, which is wired directly to
 * `modules/billing`'s own `PlanController` (see `routes/master-admin.routes.ts`'s
 * "Plan catalog" section) — this confirms that composition actually works
 * against a real router, not just that each module typechecks in isolation.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

describe('Master Admin — Plan Management API — integration', () => {
  let app: Application;
  let adminId: string;
  let adminEmail: string;

  beforeAll(async () => {
    app = createMasterAdminTestApp();
    adminEmail = `plan.admin.${randomUUID().slice(0, 8)}@example.test`;
    const passwordHash = await bcrypt.hash('irrelevant-for-this-suite', 10);
    const admin = await prisma.masterAdmin.create({
      data: { email: adminEmail, passwordHash, firstName: 'Plan', lastName: 'Admin' },
    });
    adminId = admin.id;
  });

  afterAll(async () => {
    await prisma.masterAdmin.delete({ where: { id: adminId } });
    await prisma.$disconnect();
  });

  function masterAdminToken(): string {
    return signAccessToken({ userId: adminId, email: adminEmail, role: UserRole.MASTER_ADMIN, permissions: [] });
  }

  describe('access control', () => {
    it('returns 401 with no Authorization header', async () => {
      const res = await request(app).get('/api/v1/master-admin/plans');
      expect(res.status).toBe(401);
    });

    it('returns 403 for a non-MASTER_ADMIN token', async () => {
      const res = await request(app)
        .get('/api/v1/master-admin/plans')
        .set('Authorization', `Bearer ${signAccessToken({ userId: 'user-1', tenantId: 'tenant-1', role: UserRole.TENANT_ADMIN })}`);
      expect(res.status).toBe(403);
    });
  });

  describe('plan lifecycle', () => {
    let planId: string;
    const code = `LIFECYCLE_${randomUUID().slice(0, 8).toUpperCase()}`;

    it('POST /master-admin/plans returns 201 and creates the plan', async () => {
      const res = await request(app)
        .post('/api/v1/master-admin/plans')
        .set('Authorization', `Bearer ${masterAdminToken()}`)
        .send({ code, name: 'Lifecycle Plan', billingCycle: BillingCycle.MONTHLY, priceInPaise: 50_000 });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ code, name: 'Lifecycle Plan', priceInPaise: 50_000, isActive: true });
      planId = res.body.data.id;
    });

    it('POST /master-admin/plans returns 422 when maxStorageGb is below the 1 GB minimum', async () => {
      const res = await request(app)
        .post('/api/v1/master-admin/plans')
        .set('Authorization', `Bearer ${masterAdminToken()}`)
        .send({
          code: `BELOWMIN_${randomUUID().slice(0, 8).toUpperCase()}`,
          name: 'Below Minimum',
          billingCycle: BillingCycle.MONTHLY,
          priceInPaise: 1,
          maxStorageGb: 0,
        });
      expect(res.status).toBe(422);
    });

    it('POST /master-admin/plans accepts exactly 1 GB and null (unlimited) for maxStorageGb', async () => {
      const oneGbCode = `ONEGB_${randomUUID().slice(0, 8).toUpperCase()}`;
      const oneGbRes = await request(app)
        .post('/api/v1/master-admin/plans')
        .set('Authorization', `Bearer ${masterAdminToken()}`)
        .send({ code: oneGbCode, name: 'One GB', billingCycle: BillingCycle.MONTHLY, priceInPaise: 1, maxStorageGb: 1 });
      expect(oneGbRes.status).toBe(201);
      expect(oneGbRes.body.data.maxStorageGb).toBe(1);

      const unlimitedCode = `UNLIMITED_${randomUUID().slice(0, 8).toUpperCase()}`;
      const unlimitedRes = await request(app)
        .post('/api/v1/master-admin/plans')
        .set('Authorization', `Bearer ${masterAdminToken()}`)
        .send({ code: unlimitedCode, name: 'Unlimited', billingCycle: BillingCycle.MONTHLY, priceInPaise: 1, maxStorageGb: null });
      expect(unlimitedRes.status).toBe(201);
      expect(unlimitedRes.body.data.maxStorageGb).toBeNull();

      await prisma.plan.deleteMany({ where: { code: { in: [oneGbCode, unlimitedCode] } } });
    });

    it('POST /master-admin/plans returns 409 for a duplicate code', async () => {
      const res = await request(app)
        .post('/api/v1/master-admin/plans')
        .set('Authorization', `Bearer ${masterAdminToken()}`)
        .send({ code, name: 'Duplicate', billingCycle: BillingCycle.MONTHLY, priceInPaise: 1 });
      expect(res.status).toBe(409);
    });

    it('GET /master-admin/plans returns 200 and includes the new plan with a tenantCount', async () => {
      const res = await request(app).get('/api/v1/master-admin/plans').set('Authorization', `Bearer ${masterAdminToken()}`);
      expect(res.status).toBe(200);
      const created = res.body.data.find((p: { id: string }) => p.id === planId);
      expect(created).toMatchObject({ code, tenantCount: 0 });
    });

    it('PATCH /master-admin/plans/:id updates price and deactivates the plan', async () => {
      const res = await request(app)
        .patch(`/api/v1/master-admin/plans/${planId}`)
        .set('Authorization', `Bearer ${masterAdminToken()}`)
        .send({ priceInPaise: 75_000, isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ priceInPaise: 75_000, isActive: false });
    });

    it('PATCH /master-admin/plans/:id returns 422 when maxStorageGb is below the 1 GB minimum', async () => {
      const res = await request(app)
        .patch(`/api/v1/master-admin/plans/${planId}`)
        .set('Authorization', `Bearer ${masterAdminToken()}`)
        .send({ maxStorageGb: 0 });
      expect(res.status).toBe(422);
    });

    it('PATCH /master-admin/plans/:id accepts a value above 1 GB', async () => {
      const res = await request(app)
        .patch(`/api/v1/master-admin/plans/${planId}`)
        .set('Authorization', `Bearer ${masterAdminToken()}`)
        .send({ maxStorageGb: 10 });
      expect(res.status).toBe(200);
      expect(res.body.data.maxStorageGb).toBe(10);
    });

    it('PATCH /master-admin/plans/:id returns 404 for a well-formed but unknown id', async () => {
      const res = await request(app)
        .patch(`/api/v1/master-admin/plans/${randomUUID()}`)
        .set('Authorization', `Bearer ${masterAdminToken()}`)
        .send({ priceInPaise: 1 });
      expect(res.status).toBe(404);
    });

    afterAll(async () => {
      await prisma.plan.delete({ where: { id: planId } });
    });
  });
});
