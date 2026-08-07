import request from 'supertest';
import { Application } from 'express';
import { prisma } from '@config/database';
import { createClientBillingTestApp } from '../../helpers/client-billing-test-app';
import { signAccessToken } from '../../helpers/jwt';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';
import { CLIENT_BILLING_PERMISSIONS } from '@modules/client-billing/constants/client-billing.permissions';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Firm Payment Gateway Settings API (PRD §12) — Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the full real request lifecycle against a real database:
 *   Request → authMiddleware (JWT) → tenantMiddleware → requirePermission →
 *   validate (Zod) → PaymentGatewaySettingsController →
 *   PaymentGatewaySettingsService → PaymentGatewaySettingsRepository → Postgres.
 *
 * Uses the REAL `RazorpayGatewayProvider` (no SDK mocking) for the
 * `/health` and `/capabilities` checks — `getCapabilities()` is a static,
 * non-network method, and this suite never enables a real credential pair
 * capable of reaching Razorpay's servers, so `/health` naturally reports
 * `down` (an auth failure against the real API) rather than `up`.
 * Mirrors `tests/integration/modules/tenant/storage-settings.routes.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

describe('Firm Payment Gateway Settings API — integration', () => {
  let app: Application;
  let fixtures: TestFixtures;

  const allPermissions = Object.values(CLIENT_BILLING_PERMISSIONS);

  beforeAll(async () => {
    app = createClientBillingTestApp();
    fixtures = await seedFixtures(prisma);
  });

  afterAll(async () => {
    const tenantIds = [fixtures.tenantA.tenantId, fixtures.tenantB.tenantId];
    await prisma.firmPaymentGatewaySettings.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  function tokenFor(tenantId: string, userId: string, permissions: string[] = allPermissions): string {
    return signAccessToken({ userId, tenantId, permissions });
  }

  describe('access control', () => {
    it('returns 401 with no Authorization header', async () => {
      const res = await request(app).get('/api/v1/billing/payment-gateway/settings');
      expect(res.status).toBe(401);
    });

    it('returns 403 when the caller lacks client_billing:read', async () => {
      const res = await request(app)
        .get('/api/v1/billing/payment-gateway/settings')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId, [])}`);
      expect(res.status).toBe(403);
    });

    it('returns 403 for PATCH when the caller only has client_billing:read', async () => {
      const res = await request(app)
        .patch('/api/v1/billing/payment-gateway/settings')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId, [CLIENT_BILLING_PERMISSIONS.READ])}`)
        .send({ enabled: true });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /billing/payment-gateway/settings', () => {
    it('returns a DISABLED default before the firm has ever configured a gateway', async () => {
      const res = await request(app)
        .get('/api/v1/billing/payment-gateway/settings')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId)}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ enabled: false, provider: 'DISABLED', isActive: false, hasKeySecret: false });
    });
  });

  describe('PATCH /billing/payment-gateway/settings', () => {
    it('persists the settings, encrypts the secret at rest, and never returns it', async () => {
      const token = tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId);

      const patchRes = await request(app)
        .patch('/api/v1/billing/payment-gateway/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ enabled: true, provider: 'RAZORPAY', keyId: 'rzp_test_key_a', keySecret: 'super-secret-value', isTestMode: true });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data).toMatchObject({ enabled: true, provider: 'RAZORPAY', keyId: 'rzp_test_key_a', hasKeySecret: true, isActive: true });
      expect(JSON.stringify(patchRes.body)).not.toContain('super-secret-value');

      const rawRow = await prisma.firmPaymentGatewaySettings.findUniqueOrThrow({ where: { tenantId: fixtures.tenantA.tenantId } });
      expect(rawRow.encryptedKeySecret).not.toBeNull();
      expect(rawRow.encryptedKeySecret).not.toContain('super-secret-value');

      const getRes = await request(app).get('/api/v1/billing/payment-gateway/settings').set('Authorization', `Bearer ${token}`);
      expect(getRes.body.data.hasKeySecret).toBe(true);
      expect(JSON.stringify(getRes.body)).not.toContain('super-secret-value');
    });

    it('leaves the stored secret untouched when a later PATCH omits keySecret', async () => {
      const token = tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId);
      const before = await prisma.firmPaymentGatewaySettings.findUniqueOrThrow({ where: { tenantId: fixtures.tenantA.tenantId } });

      const res = await request(app)
        .patch('/api/v1/billing/payment-gateway/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ isTestMode: false });

      expect(res.status).toBe(200);
      expect(res.body.data.isTestMode).toBe(false);

      const after = await prisma.firmPaymentGatewaySettings.findUniqueOrThrow({ where: { tenantId: fixtures.tenantA.tenantId } });
      expect(after.encryptedKeySecret).toBe(before.encryptedKeySecret);
    });

    it('writes a SETTINGS_UPDATE audit log entry', async () => {
      const token = tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId);
      await request(app).patch('/api/v1/billing/payment-gateway/settings').set('Authorization', `Bearer ${token}`).send({ enabled: false });

      const auditEntry = await prisma.auditLog.findFirst({
        where: { tenantId: fixtures.tenantA.tenantId, eventType: 'SETTINGS_UPDATE', targetType: 'FirmPaymentGatewaySettings' },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditEntry).not.toBeNull();
    });

    it('rejects an unknown provider value with 422', async () => {
      const res = await request(app)
        .patch('/api/v1/billing/payment-gateway/settings')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId)}`)
        .send({ provider: 'STRIPE' });

      expect(res.status).toBe(422);
    });
  });

  describe('GET /billing/payment-gateway/settings/capabilities', () => {
    it('reports every capability as unsupported before any provider is configured', async () => {
      const res = await request(app)
        .get('/api/v1/billing/payment-gateway/settings/capabilities')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantB.tenantId, fixtures.tenantB.userId)}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        provider: 'DISABLED',
        supportsPaymentLinks: false,
        supportsRefunds: false,
        supportsPartialPayments: false,
        supportedCurrencies: [],
      });
    });

    it('reports RAZORPAY capabilities once configured, without needing real network access', async () => {
      const token = tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId);
      await request(app)
        .patch('/api/v1/billing/payment-gateway/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ enabled: true, provider: 'RAZORPAY', keyId: 'rzp_test_key_a', keySecret: 'super-secret-value' });

      const res = await request(app).get('/api/v1/billing/payment-gateway/settings/capabilities').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        provider: 'RAZORPAY',
        supportsPaymentLinks: true,
        supportsRefunds: true,
        supportsPartialPayments: true,
        supportedCurrencies: ['INR'],
      });
    });
  });

  describe('GET /billing/payment-gateway/settings/health', () => {
    it('reports unconfigured before any provider is set up', async () => {
      const res = await request(app)
        .get('/api/v1/billing/payment-gateway/settings/health')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantB.tenantId, fixtures.tenantB.userId)}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ provider: 'DISABLED', status: 'unconfigured' });
    });
  });

  describe('tenant isolation', () => {
    it("tenant B's settings are unaffected by tenant A's PATCH, and tenant B never sees tenant A's provider/key", async () => {
      const tokenA = tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId);
      await request(app)
        .patch('/api/v1/billing/payment-gateway/settings')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ enabled: true, provider: 'RAZORPAY', keyId: 'rzp_tenant_a_only', keySecret: 'tenant-a-secret' });

      const res = await request(app)
        .get('/api/v1/billing/payment-gateway/settings')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantB.tenantId, fixtures.tenantB.userId)}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ enabled: false, provider: 'DISABLED', keyId: null, hasKeySecret: false });
    });
  });
});
