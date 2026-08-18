import request from 'supertest';
import crypto from 'crypto';
import { Application } from 'express';
import { prisma } from '@config/database';
import { InvoiceStatus, PaymentGatewayLinkStatus, PaymentGatewayProviderType } from '@prisma/client';
import { CryptoUtils } from '@shared/utils';
import { paymentGatewayEncryptionConfig } from '@config/payment-gateway-encryption';
import { createClientBillingTestApp } from '../../helpers/client-billing-test-app';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Firm Payment Gateway Webhook (PRD §12) — Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Public, unauthenticated route (no JWT) — see
 * `modules/client-billing/routes/payment-gateway-webhook.routes.ts`'s header
 * comment. Signatures are computed with the SAME HMAC-SHA256 algorithm
 * Razorpay's own `Razorpay.validateWebhookSignature` uses internally (plain
 * `crypto`, no network call), so the real `RazorpayGatewayProvider` is used
 * unmocked here — only the SDK's own network-bound methods
 * (`paymentLink.create/fetch/all`, `payments.refund`) would ever need
 * mocking, and this suite never calls them.
 *
 * A `PaymentGatewayLink` row is seeded directly via Prisma (simulating "a
 * link was already generated") rather than going through
 * `POST /billing/payment-links`, keeping this suite focused purely on the
 * webhook pipeline.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

describe('Payment Gateway Webhook API — integration', () => {
  let app: Application;
  let fixtures: TestFixtures;

  const WEBHOOK_SECRET = 'firm-a-webhook-secret';

  beforeAll(async () => {
    app = createClientBillingTestApp();
    fixtures = await seedFixtures(prisma);
  });

  afterAll(async () => {
    const tenantIds = [fixtures.tenantA.tenantId, fixtures.tenantB.tenantId];
    await prisma.paymentGatewayLink.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.payment.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.invoice.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.firmPaymentGatewaySettings.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  async function seedGatewayFixture(tenantId: string, webhookSecret = WEBHOOK_SECRET) {
    const key = paymentGatewayEncryptionConfig.key as string;
    await prisma.firmPaymentGatewaySettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        enabled: true,
        provider: PaymentGatewayProviderType.RAZORPAY,
        keyId: 'rzp_test_key',
        encryptedKeySecret: CryptoUtils.encryptSecret('test-key-secret', key),
        encryptedWebhookSecret: CryptoUtils.encryptSecret(webhookSecret, key),
        isTestMode: true,
        isActive: true,
      },
      update: { encryptedWebhookSecret: CryptoUtils.encryptSecret(webhookSecret, key) },
    });

    const invoice = await prisma.invoice.create({
      data: { tenantId, invoiceNumber: `INV-WH-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, amount: 1000, tax: 180, status: InvoiceStatus.SENT },
    });

    const link = await prisma.paymentGatewayLink.create({
      data: {
        tenantId,
        invoiceId: invoice.id,
        provider: PaymentGatewayProviderType.RAZORPAY,
        providerPaymentId: `plink_wh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        url: 'https://rzp.io/i/webhook-test',
        amountInPaise: 118000,
        currency: 'INR',
        status: PaymentGatewayLinkStatus.CREATED,
      },
    });

    return { invoice, link };
  }

  function paidPayload(providerPaymentId: string, paymentId = 'pay_webhook_test') {
    return JSON.stringify({
      event: 'payment_link.paid',
      payload: {
        payment_link: { entity: { id: providerPaymentId } },
        payment: { entity: { id: paymentId } },
      },
    });
  }

  function sign(body: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(body).digest('hex');
  }

  it('returns 403 when the signature does not match the OWNING tenant\'s own webhook secret', async () => {
    const { link } = await seedGatewayFixture(fixtures.tenantA.tenantId);
    const body = paidPayload(link.providerPaymentId);

    const res = await request(app)
      .post('/api/v1/billing/payment-gateway/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sign(body, 'wrong-secret'))
      .send(body);

    expect(res.status).toBe(403);
  });

  it('returns 200 and no-ops for an unknown payment link (never seen before)', async () => {
    const body = paidPayload('plink_never_seen');

    const res = await request(app)
      .post('/api/v1/billing/payment-gateway/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sign(body, 'irrelevant'))
      .send(body);

    expect(res.status).toBe(200);
  });

  it('confirms payment on a valid signature: creates a Payment, marks the link PAID, marks the invoice PAID', async () => {
    const { invoice, link } = await seedGatewayFixture(fixtures.tenantA.tenantId);
    const body = paidPayload(link.providerPaymentId, 'pay_confirmed_1');

    const res = await request(app)
      .post('/api/v1/billing/payment-gateway/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sign(body, WEBHOOK_SECRET))
      .send(body);

    expect(res.status).toBe(200);

    const updatedLink = await prisma.paymentGatewayLink.findUniqueOrThrow({ where: { id: link.id } });
    expect(updatedLink.status).toBe(PaymentGatewayLinkStatus.PAID);
    expect(updatedLink.paymentId).not.toBeNull();

    const updatedInvoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(updatedInvoice.status).toBe(InvoiceStatus.PAID);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: updatedLink.paymentId as string } });
    expect(payment).toMatchObject({ tenantId: fixtures.tenantA.tenantId, invoiceId: invoice.id, reference: 'pay_confirmed_1', status: 'COMPLETED' });
    expect(payment.amount.toNumber()).toBe(1180);
  });

  it('is idempotent: replaying the same valid webhook does not create a second Payment', async () => {
    const { link } = await seedGatewayFixture(fixtures.tenantA.tenantId);
    const body = paidPayload(link.providerPaymentId, 'pay_replayed');
    const signature = sign(body, WEBHOOK_SECRET);

    await request(app).post('/api/v1/billing/payment-gateway/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', signature).send(body);
    const secondRes = await request(app).post('/api/v1/billing/payment-gateway/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', signature).send(body);

    expect(secondRes.status).toBe(200);
    const payments = await prisma.payment.findMany({ where: { invoiceId: link.invoiceId } });
    expect(payments).toHaveLength(1);
  });

  it("tenant isolation: tenant B's webhook secret cannot confirm tenant A's payment link", async () => {
    const { link: linkA } = await seedGatewayFixture(fixtures.tenantA.tenantId, 'secret-a');
    await seedGatewayFixture(fixtures.tenantB.tenantId, 'secret-b');

    const body = paidPayload(linkA.providerPaymentId);
    const res = await request(app)
      .post('/api/v1/billing/payment-gateway/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sign(body, 'secret-b'))
      .send(body);

    expect(res.status).toBe(403);
    const unchangedLink = await prisma.paymentGatewayLink.findUniqueOrThrow({ where: { id: linkA.id } });
    expect(unchangedLink.status).toBe(PaymentGatewayLinkStatus.CREATED);
  });
});
