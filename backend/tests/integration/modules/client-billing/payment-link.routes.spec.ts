import request from 'supertest';
import { Application } from 'express';

/**
 * The `razorpay` SDK is mocked at the module level (real network calls would
 * hang/fail in CI) — `paymentLink.create` returns a canned Payment Link,
 * exactly like `tests/unit/modules/client-billing/providers/razorpay-gateway.provider.spec.ts`.
 * Everything else in this suite (auth, tenant scoping, permission gating,
 * Zod validation, invoice-status guard, DB persistence) exercises the REAL
 * request lifecycle.
 */
const paymentLinkCreate = jest.fn();
jest.mock('razorpay', () => {
  const MockRazorpay = jest.fn().mockImplementation(() => ({
    paymentLink: { create: paymentLinkCreate, fetch: jest.fn(), all: jest.fn() },
    payments: { refund: jest.fn() },
  }));
  (MockRazorpay as unknown as { validateWebhookSignature: jest.Mock }).validateWebhookSignature = jest.fn();
  return { __esModule: true, default: MockRazorpay };
});

import { prisma } from '@config/database';
import { InvoiceStatus } from '@prisma/client';
import { createClientBillingTestApp } from '../../helpers/client-billing-test-app';
import { signAccessToken } from '../../helpers/jwt';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';
import { CLIENT_BILLING_PERMISSIONS } from '@modules/client-billing/constants/client-billing.permissions';

jest.setTimeout(30000);

describe('Payment Link API (PRD §12) — integration', () => {
  let app: Application;
  let fixtures: TestFixtures;

  const allPermissions = Object.values(CLIENT_BILLING_PERMISSIONS);

  beforeAll(async () => {
    app = createClientBillingTestApp();
    fixtures = await seedFixtures(prisma);
  });

  afterEach(() => {
    paymentLinkCreate.mockReset();
  });

  afterAll(async () => {
    const tenantIds = [fixtures.tenantA.tenantId, fixtures.tenantB.tenantId];
    await prisma.paymentGatewayLink.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.invoice.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.firmPaymentGatewaySettings.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  function tokenFor(tenantId: string, userId: string, permissions: string[] = allPermissions): string {
    return signAccessToken({ userId, tenantId, permissions });
  }

  async function createInvoice(tenantId: string, status: InvoiceStatus = InvoiceStatus.SENT) {
    return prisma.invoice.create({
      data: { tenantId, invoiceNumber: `INV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, amount: 1000, tax: 180, status },
    });
  }

  async function enableGateway(tenantId: string, token: string) {
    await request(app)
      .patch('/api/v1/billing/payment-gateway/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: true, provider: 'RAZORPAY', keyId: 'rzp_test_key', keySecret: 'test-secret' });
  }

  describe('POST /billing/payment-links', () => {
    it('returns 503 when the firm has no gateway configured', async () => {
      const token = tokenFor(fixtures.tenantB.tenantId, fixtures.tenantB.userId);
      const invoice = await createInvoice(fixtures.tenantB.tenantId);

      const res = await request(app).post('/api/v1/billing/payment-links').set('Authorization', `Bearer ${token}`).send({ invoiceId: invoice.id });

      expect(res.status).toBe(503);
      expect(paymentLinkCreate).not.toHaveBeenCalled();
    });

    it('generates a payment link through the configured provider and persists it', async () => {
      const token = tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId);
      await enableGateway(fixtures.tenantA.tenantId, token);
      const invoice = await createInvoice(fixtures.tenantA.tenantId);

      paymentLinkCreate.mockResolvedValue({
        id: 'plink_integration_1',
        short_url: 'https://rzp.io/i/integration1',
        status: 'created',
        expire_by: Math.floor(Date.now() / 1000) + 3600,
      });

      const res = await request(app).post('/api/v1/billing/payment-links').set('Authorization', `Bearer ${token}`).send({ invoiceId: invoice.id });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        invoiceId: invoice.id,
        provider: 'RAZORPAY',
        providerPaymentId: 'plink_integration_1',
        url: 'https://rzp.io/i/integration1',
        status: 'CREATED',
      });
      expect(paymentLinkCreate).toHaveBeenCalledWith(expect.objectContaining({ amount: 118000, currency: 'INR' }));

      const stored = await prisma.paymentGatewayLink.findUnique({ where: { providerPaymentId: 'plink_integration_1' } });
      expect(stored).not.toBeNull();
      expect(stored?.tenantId).toBe(fixtures.tenantA.tenantId);
    });

    it('returns 409 for an already-PAID invoice', async () => {
      const token = tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId);
      await enableGateway(fixtures.tenantA.tenantId, token);
      const invoice = await createInvoice(fixtures.tenantA.tenantId, InvoiceStatus.PAID);

      const res = await request(app).post('/api/v1/billing/payment-links').set('Authorization', `Bearer ${token}`).send({ invoiceId: invoice.id });

      expect(res.status).toBe(409);
      expect(paymentLinkCreate).not.toHaveBeenCalled();
    });

    it('returns 404 for an invoice belonging to another tenant', async () => {
      const tokenA = tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId);
      await enableGateway(fixtures.tenantA.tenantId, tokenA);
      const invoiceB = await createInvoice(fixtures.tenantB.tenantId);

      const res = await request(app).post('/api/v1/billing/payment-links').set('Authorization', `Bearer ${tokenA}`).send({ invoiceId: invoiceB.id });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /billing/payment-links', () => {
    it('lists links scoped to the invoice and tenant', async () => {
      const token = tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId);
      await enableGateway(fixtures.tenantA.tenantId, token);
      const invoice = await createInvoice(fixtures.tenantA.tenantId);

      paymentLinkCreate.mockResolvedValue({ id: 'plink_list_1', short_url: 'https://rzp.io/i/list1', status: 'created' });
      await request(app).post('/api/v1/billing/payment-links').set('Authorization', `Bearer ${token}`).send({ invoiceId: invoice.id });

      const res = await request(app).get(`/api/v1/billing/payment-links?invoiceId=${invoice.id}`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].providerPaymentId).toBe('plink_list_1');
    });
  });
});
