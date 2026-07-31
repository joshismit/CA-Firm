import { randomUUID } from 'crypto';
import request from 'supertest';
import { Application } from 'express';
import { BillingCycle } from '@prisma/client';
import { prisma } from '@config/database';
import { createBillingTestApp } from '../../helpers/billing-test-app';
import { signAccessToken } from '../../helpers/jwt';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';
import { BILLING_PERMISSIONS } from '@modules/billing/constants/billing.permissions';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Billing API (tenant-facing) — Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the full real request lifecycle against a real database:
 *   Request → authMiddleware (JWT) → tenantMiddleware → requirePermission →
 *   validate (Zod) → BillingController/PlanController → BillingService/
 *   PlanService → repositories → Postgres.
 *
 * `POST /subscription/checkout` branches on whether real Razorpay test keys
 * are present in `.env` (`RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`) — without
 * them it asserts the 503 "not configured" guard; with them, it exercises a
 * real order creation against Razorpay's sandbox API. Either way this test
 * file passes without needing to hardcode which environment it's running in.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

const RAZORPAY_CONFIGURED = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

describe('Billing API (tenant-facing) — integration', () => {
  let app: Application;
  let fixtures: TestFixtures;
  let planId: string;
  let planCode: string;

  beforeAll(async () => {
    app = createBillingTestApp();
    fixtures = await seedFixtures(prisma);

    planCode = `TEST_PLAN_${randomUUID().slice(0, 8).toUpperCase()}`;
    const plan = await prisma.plan.create({
      data: {
        code: planCode,
        name: 'Integration Test Plan',
        billingCycle: BillingCycle.MONTHLY,
        priceInPaise: 100_00,
        maxUsers: 5,
      },
    });
    planId = plan.id;
  });

  afterAll(async () => {
    await prisma.platformInvoice.deleteMany({ where: { planId } });
    await prisma.plan.delete({ where: { id: planId } });
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  function tokenForTenantA(permissions: string[] = Object.values(BILLING_PERMISSIONS)): string {
    return signAccessToken({ userId: fixtures.tenantA.userId, tenantId: fixtures.tenantA.tenantId, permissions });
  }

  describe('access control', () => {
    it('returns 401 with no Authorization header', async () => {
      const res = await request(app).get('/api/v1/subscription/plans');
      expect(res.status).toBe(401);
    });

    it('returns 403 when the caller lacks billing:read', async () => {
      const res = await request(app).get('/api/v1/subscription/plans').set('Authorization', `Bearer ${tokenForTenantA([])}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /subscription/plans', () => {
    it('returns 200 and includes the seeded test plan', async () => {
      const res = await request(app).get('/api/v1/subscription/plans').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      const codes = res.body.data.map((p: { code: string }) => p.code);
      expect(codes).toContain(planCode);
    });
  });

  describe('GET /subscription/current', () => {
    it('returns a null plan before the tenant has subscribed to anything', async () => {
      const res = await request(app).get('/api/v1/subscription/current').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      expect(res.body.data.plan).toBeNull();
    });

    it('reflects the tenant plan once one is set', async () => {
      await prisma.tenant.update({ where: { id: fixtures.tenantA.tenantId }, data: { planCode } });

      const res = await request(app).get('/api/v1/subscription/current').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      expect(res.body.data.plan).toMatchObject({ code: planCode });
    });
  });

  describe('GET /subscription/invoices', () => {
    it('returns an empty paginated list when the tenant has never checked out', async () => {
      const res = await request(app).get('/api/v1/subscription/invoices').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.meta.total).toBe(0);
    });
  });

  describe('subscription enforcement (tenantMiddleware)', () => {
    function tokenForTenantB(): string {
      return signAccessToken({ userId: fixtures.tenantB.userId, tenantId: fixtures.tenantB.tenantId, permissions: Object.values(BILLING_PERMISSIONS) });
    }

    it('returns 403 once a TRIAL tenant\'s subscriptionExpiresAt has passed', async () => {
      await prisma.tenant.update({
        where: { id: fixtures.tenantB.tenantId },
        data: { subscriptionStatus: 'TRIAL', subscriptionExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });

      const res = await request(app).get('/api/v1/subscription/plans').set('Authorization', `Bearer ${tokenForTenantB()}`);
      expect(res.status).toBe(403);
    });

    it('returns 403 for a CANCELLED subscription regardless of trial expiry', async () => {
      await prisma.tenant.update({
        where: { id: fixtures.tenantB.tenantId },
        data: { subscriptionStatus: 'CANCELLED', subscriptionExpiresAt: null },
      });

      const res = await request(app).get('/api/v1/subscription/plans').set('Authorization', `Bearer ${tokenForTenantB()}`);
      expect(res.status).toBe(403);
    });

    it('allows a PAST_DUE tenant through (grace period, not an instant lockout)', async () => {
      await prisma.tenant.update({
        where: { id: fixtures.tenantB.tenantId },
        data: { subscriptionStatus: 'PAST_DUE', subscriptionExpiresAt: null },
      });

      const res = await request(app).get('/api/v1/subscription/plans').set('Authorization', `Bearer ${tokenForTenantB()}`);
      expect(res.status).toBe(200);
    });

    it('allows an ACTIVE, unexpired subscription through', async () => {
      await prisma.tenant.update({
        where: { id: fixtures.tenantB.tenantId },
        data: { subscriptionStatus: 'ACTIVE', subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      });

      const res = await request(app).get('/api/v1/subscription/plans').set('Authorization', `Bearer ${tokenForTenantB()}`);
      expect(res.status).toBe(200);
    });
  });

  describe('POST /subscription/webhook', () => {
    it('acknowledges with 200 when RAZORPAY_WEBHOOK_SECRET is not configured (local dev has no public URL)', async () => {
      const res = await request(app)
        .post('/api/v1/subscription/webhook')
        .send({ event: 'payment.captured', payload: {} });
      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
    });
  });

  // Deliberately last: when Razorpay is configured, this makes a real network call to Razorpay's
  // sandbox API, which leaves a lingering keep-alive socket open in this short-lived test process
  // (the SDK exposes no explicit `.close()`). Running it last means nothing else in this file has
  // to share the event loop with that socket while waiting on its own local `supertest` request.
  describe('POST /subscription/checkout', () => {
    it('returns 422 for an unknown planCode format', async () => {
      const res = await request(app)
        .post('/api/v1/subscription/checkout')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({});
      expect(res.status).toBe(422);
    });

    it('returns 404 for an unknown plan code', async () => {
      const res = await request(app)
        .post('/api/v1/subscription/checkout')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ planCode: 'NO_SUCH_PLAN' });
      expect(res.status).toBe(404);
    });

    if (!RAZORPAY_CONFIGURED) {
      it('returns 503 when Razorpay is not configured', async () => {
        const res = await request(app)
          .post('/api/v1/subscription/checkout')
          .set('Authorization', `Bearer ${tokenForTenantA()}`)
          .send({ planCode });
        expect(res.status).toBe(503);
      });
    } else {
      it('creates a real Razorpay order and a PENDING invoice', async () => {
        const res = await request(app)
          .post('/api/v1/subscription/checkout')
          .set('Authorization', `Bearer ${tokenForTenantA()}`)
          .send({ planCode });

        expect(res.status).toBe(201);
        expect(res.body.data.razorpayOrderId).toMatch(/^order_/);
        expect(res.body.data.amountInPaise).toBe(100_00);

        const invoice = await prisma.platformInvoice.findUnique({ where: { razorpayOrderId: res.body.data.razorpayOrderId } });
        expect(invoice?.status).toBe('PENDING');
      });
    }
  });
});
