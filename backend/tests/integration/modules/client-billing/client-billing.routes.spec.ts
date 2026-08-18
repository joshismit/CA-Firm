import { randomUUID } from 'crypto';
import request from 'supertest';
import { Application } from 'express';
import { prisma } from '@config/database';
import { createClientBillingTestApp } from '../../helpers/client-billing-test-app';
import { signAccessToken } from '../../helpers/jwt';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';
import { CLIENT_BILLING_PERMISSIONS } from '@modules/client-billing/constants/client-billing.permissions';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Client Billing API — Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the full real request lifecycle against a real database for all
 * three sub-resources: Request → authMiddleware (JWT) → tenantMiddleware →
 * requirePermission → validate (Zod) → *Controller → *Service →
 * *Repository → Postgres.
 *
 * Reuses `seedFixtures`/`cleanupFixtures`/`signAccessToken` from the Project
 * integration suite's helpers — each fixture tenant already has a real
 * `Business` + `Client` row (see `helpers/fixtures.ts`), reused here as the
 * targets for Invoice's `clientId`/`businessId` cross-tenant guard tests.
 * Mirrors `tests/integration/modules/roles/role.routes.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

describe('Client Billing API — integration', () => {
  let app: Application;
  let fixtures: TestFixtures;
  let tenantABusinessId: string;
  let tenantBBusinessId: string;

  const allPermissions = Object.values(CLIENT_BILLING_PERMISSIONS);

  beforeAll(async () => {
    app = createClientBillingTestApp();
    fixtures = await seedFixtures(prisma);

    const tenantAClient = await prisma.client.findUniqueOrThrow({ where: { id: fixtures.tenantA.clientId } });
    tenantABusinessId = tenantAClient.businessId;

    const tenantBClient = await prisma.client.findUniqueOrThrow({ where: { id: fixtures.tenantB.clientId } });
    tenantBBusinessId = tenantBClient.businessId;
  });

  afterAll(async () => {
    const tenantIds = [fixtures.tenantA.tenantId, fixtures.tenantB.tenantId];
    await prisma.payment.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.invoice.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.expense.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  function tokenForTenantA(permissions: string[] = allPermissions): string {
    return signAccessToken({ userId: fixtures.tenantA.userId, tenantId: fixtures.tenantA.tenantId, permissions });
  }

  function tokenForTenantB(permissions: string[] = allPermissions): string {
    return signAccessToken({ userId: fixtures.tenantB.userId, tenantId: fixtures.tenantB.tenantId, permissions });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Authentication / Permission middleware (shared across all 3 routers)
  // ────────────────────────────────────────────────────────────────────────
  describe('authentication and permission middleware', () => {
    it('returns 401 when no Authorization header is present', async () => {
      const res = await request(app).get('/api/v1/billing/invoices');
      expect(res.status).toBe(401);
    });

    it('returns 403 when the caller lacks client_billing:read', async () => {
      const res = await request(app).get('/api/v1/billing/invoices').set('Authorization', `Bearer ${tokenForTenantA([])}`);
      expect(res.status).toBe(403);
    });

    it('returns 403 when the caller lacks client_billing:manage for create', async () => {
      const res = await request(app)
        .post('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${tokenForTenantA([CLIENT_BILLING_PERMISSIONS.READ])}`)
        .send({ invoiceNumber: 'INV-NOPERM', amount: 100 });
      expect(res.status).toBe(403);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Validation middleware
  // ────────────────────────────────────────────────────────────────────────
  describe('validation middleware', () => {
    it('returns 422 when creating an invoice without invoiceNumber', async () => {
      const res = await request(app)
        .post('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ amount: 100 });
      expect(res.status).toBe(422);
    });

    it('returns 422 for an invalid path param (non-UUID id)', async () => {
      const res = await request(app).get('/api/v1/billing/invoices/not-a-uuid').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(422);
    });

    it('returns 422 when creating an expense without a category', async () => {
      const res = await request(app)
        .post('/api/v1/billing/expenses')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ expenseNumber: 'EXP-NOCAT', amount: 50 });
      expect(res.status).toBe(422);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Invoice lifecycle + cross-tenant references
  // ────────────────────────────────────────────────────────────────────────
  describe('invoice lifecycle', () => {
    let invoiceId: string;

    it('POST /billing/invoices returns 201 and creates the invoice as DRAFT', async () => {
      const res = await request(app)
        .post('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ invoiceNumber: 'INV-1001', clientId: fixtures.tenantA.clientId, businessId: tenantABusinessId, amount: 1000, tax: 180 });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        invoiceNumber: 'INV-1001',
        clientId: fixtures.tenantA.clientId,
        businessId: tenantABusinessId,
        amount: 1000,
        tax: 180,
        status: 'DRAFT',
      });
      invoiceId = res.body.data.id;
    });

    it('POST /billing/invoices returns 409 for a duplicate invoiceNumber in the tenant', async () => {
      const res = await request(app)
        .post('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ invoiceNumber: 'INV-1001', amount: 1 });
      expect(res.status).toBe(409);
    });

    it('POST /billing/invoices returns 404 for a clientId belonging to another tenant', async () => {
      const res = await request(app)
        .post('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ invoiceNumber: 'INV-CROSS', amount: 100, clientId: fixtures.tenantB.clientId });
      expect(res.status).toBe(404);
    });

    it('POST /billing/invoices returns 404 for a businessId that does not exist', async () => {
      const res = await request(app)
        .post('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ invoiceNumber: 'INV-BADBIZ', amount: 100, businessId: randomUUID() });
      expect(res.status).toBe(404);
    });

    it('GET /billing/invoices returns 200 with a paginated list including the invoice', async () => {
      const res = await request(app).get('/api/v1/billing/invoices').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.map((i: { id: string }) => i.id);
      expect(ids).toContain(invoiceId);
    });

    it('GET /billing/invoices/:id returns 200 with the invoice', async () => {
      const res = await request(app).get(`/api/v1/billing/invoices/${invoiceId}`).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(invoiceId);
    });

    it('GET /billing/invoices/:id returns 404 for a well-formed but unknown id', async () => {
      const res = await request(app).get(`/api/v1/billing/invoices/${randomUUID()}`).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(404);
    });

    it('PATCH /billing/invoices/:id returns 200 and updates the invoice', async () => {
      const res = await request(app)
        .patch(`/api/v1/billing/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ notes: 'Updated notes' });
      expect(res.status).toBe(200);
      expect(res.body.data.notes).toBe('Updated notes');
    });

    it('DELETE /billing/invoices/:id returns 200 and soft-deletes the invoice', async () => {
      const res = await request(app).delete(`/api/v1/billing/invoices/${invoiceId}`).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
    });

    it('GET /billing/invoices/:id returns 404 once soft-deleted', async () => {
      const res = await request(app).get(`/api/v1/billing/invoices/${invoiceId}`).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(404);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Expense lifecycle + category filter
  // ────────────────────────────────────────────────────────────────────────
  describe('expense lifecycle', () => {
    let expenseId: string;

    it('POST /billing/expenses returns 201 and creates the expense as DRAFT', async () => {
      const res = await request(app)
        .post('/api/v1/billing/expenses')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ expenseNumber: 'EXP-2001', category: 'RENT', vendor: 'Acme Landlord', amount: 5000 });
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ expenseNumber: 'EXP-2001', category: 'RENT', status: 'DRAFT' });
      expenseId = res.body.data.id;
    });

    it('GET /billing/expenses filters by category', async () => {
      const res = await request(app)
        .get('/api/v1/billing/expenses')
        .query({ category: 'RENT' })
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.map((e: { id: string }) => e.id);
      expect(ids).toContain(expenseId);
      expect(res.body.data.every((e: { category: string }) => e.category === 'RENT')).toBe(true);
    });

    it('PATCH /billing/expenses/:id returns 200 and updates the expense', async () => {
      const res = await request(app)
        .patch(`/api/v1/billing/expenses/${expenseId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ vendor: 'New Landlord' });
      expect(res.status).toBe(200);
      expect(res.body.data.vendor).toBe('New Landlord');
    });

    it('DELETE /billing/expenses/:id returns 200 and soft-deletes the expense', async () => {
      const res = await request(app).delete(`/api/v1/billing/expenses/${expenseId}`).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);

      const getRes = await request(app).get(`/api/v1/billing/expenses/${expenseId}`).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(getRes.status).toBe(404);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Payment lifecycle + cross-entity invoiceId reference
  // ────────────────────────────────────────────────────────────────────────
  describe('payment lifecycle and invoice cross-reference', () => {
    let invoiceId: string;
    let paymentId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ invoiceNumber: 'INV-FOR-PAYMENT', amount: 2000 });
      invoiceId = res.body.data.id;
    });

    it('POST /billing/payments returns 404 for an invoiceId belonging to another tenant', async () => {
      const otherRes = await request(app)
        .post('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${tokenForTenantB()}`)
        .send({ invoiceNumber: 'INV-TENANT-B', amount: 500 });
      const tenantBInvoiceId = otherRes.body.data.id;

      const res = await request(app)
        .post('/api/v1/billing/payments')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ paymentNumber: 'PAY-CROSS', amount: 100, invoiceId: tenantBInvoiceId });
      expect(res.status).toBe(404);
    });

    it('POST /billing/payments returns 404 for an unknown invoiceId', async () => {
      const res = await request(app)
        .post('/api/v1/billing/payments')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ paymentNumber: 'PAY-UNKNOWN', amount: 100, invoiceId: randomUUID() });
      expect(res.status).toBe(404);
    });

    it('POST /billing/payments returns 201 and creates the payment as PENDING, linked to the invoice', async () => {
      const res = await request(app)
        .post('/api/v1/billing/payments')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ paymentNumber: 'PAY-3001', amount: 2000, invoiceId, method: 'BANK_TRANSFER', reference: 'UTR123' });
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ paymentNumber: 'PAY-3001', invoiceId, status: 'PENDING' });
      paymentId = res.body.data.id;
    });

    it('GET /billing/payments/:id returns 200 with the payment', async () => {
      const res = await request(app).get(`/api/v1/billing/payments/${paymentId}`).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      expect(res.body.data.invoiceId).toBe(invoiceId);
    });

    it('DELETE /billing/payments/:id returns 200 and soft-deletes the payment', async () => {
      const res = await request(app).delete(`/api/v1/billing/payments/${paymentId}`).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Tenant isolation
  // ────────────────────────────────────────────────────────────────────────
  describe('tenant isolation', () => {
    let tenantAInvoiceId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ invoiceNumber: 'INV-TENANT-A-ONLY', amount: 300 });
      tenantAInvoiceId = res.body.data.id;
    });

    it("returns 404 when tenant B requests tenant A's invoice by id", async () => {
      const res = await request(app).get(`/api/v1/billing/invoices/${tenantAInvoiceId}`).set('Authorization', `Bearer ${tokenForTenantB()}`);
      expect(res.status).toBe(404);
    });

    it("does not include tenant A's invoice in tenant B's list", async () => {
      const res = await request(app).get('/api/v1/billing/invoices').set('Authorization', `Bearer ${tokenForTenantB()}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.map((i: { id: string }) => i.id);
      expect(ids).not.toContain(tenantAInvoiceId);
    });
  });
});
