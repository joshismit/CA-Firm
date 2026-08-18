import request from 'supertest';
import { Application } from 'express';
import { prisma } from '@config/database';
import { IntegrationCategory, IntegrationConnectionStatus } from '@prisma/client';
import { createIntegrationTestApp } from '../../helpers/integration-test-app';
import { signAccessToken } from '../../helpers/jwt';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';
import { INTEGRATION_PERMISSIONS } from '@modules/integrations/constants/integration.permissions';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Integration Framework API (PRD §17) — Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the full real request lifecycle against a real database, exactly
 * like `payment-gateway-settings.routes.spec.ts`. No real third-party
 * provider is registered (PRD §17 ships the framework only), so every
 * `connect()` here goes through the "no provider registered yet" branch —
 * see `IntegrationConnectionService.connect()`'s own comment — and lands as
 * `PENDING`, never `CONNECTED`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

describe('Integration Framework API — integration', () => {
  let app: Application;
  let fixtures: TestFixtures;
  const allPermissions = Object.values(INTEGRATION_PERMISSIONS);
  const providerKey = `test-tally-${Date.now()}`;

  beforeAll(async () => {
    app = createIntegrationTestApp();
    fixtures = await seedFixtures(prisma);
    await prisma.integrationProvider.create({
      data: { key: providerKey, name: 'Test Tally', category: IntegrationCategory.ACCOUNTING, isActive: true },
    });
  });

  afterAll(async () => {
    const tenantIds = [fixtures.tenantA.tenantId, fixtures.tenantB.tenantId];
    await prisma.integrationSync.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.integrationConnection.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.integrationProvider.deleteMany({ where: { key: providerKey } });
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  function tokenFor(tenantId: string, userId: string, permissions: string[] = allPermissions): string {
    return signAccessToken({ userId, tenantId, permissions });
  }

  describe('access control', () => {
    it('returns 401 with no Authorization header', async () => {
      const res = await request(app).get('/api/v1/integrations');
      expect(res.status).toBe(401);
    });

    it('returns 403 when the caller lacks integrations:read', async () => {
      const res = await request(app)
        .get('/api/v1/integrations')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId, [])}`);
      expect(res.status).toBe(403);
    });

    it('returns 403 for POST /connect when the caller only has integrations:read', async () => {
      const res = await request(app)
        .post('/api/v1/integrations/connect')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId, [INTEGRATION_PERMISSIONS.READ])}`)
        .send({ providerKey, credentials: { apiKey: 'x' } });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /integrations/providers', () => {
    it('lists the catalog with isRegistered: false for every provider today', async () => {
      const res = await request(app)
        .get('/api/v1/integrations/providers')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId)}`);

      expect(res.status).toBe(200);
      const entry = res.body.data.find((p: { key: string }) => p.key === providerKey);
      expect(entry).toMatchObject({ key: providerKey, name: 'Test Tally', isRegistered: false });
    });
  });

  describe('POST /integrations/connect', () => {
    it('rejects an unknown providerKey with 404', async () => {
      const res = await request(app)
        .post('/api/v1/integrations/connect')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId)}`)
        .send({ providerKey: 'does-not-exist', credentials: { apiKey: 'x' } });
      expect(res.status).toBe(404);
    });

    it('creates a connection, encrypts credentials, and never returns them', async () => {
      const res = await request(app)
        .post('/api/v1/integrations/connect')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId)}`)
        .send({ providerKey, credentials: { apiKey: 'super-secret-tally-key' }, label: 'Main Office' });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ providerKey, providerName: 'Test Tally', label: 'Main Office', hasCredentials: true, status: IntegrationConnectionStatus.PENDING });
      expect(JSON.stringify(res.body)).not.toContain('super-secret-tally-key');

      const raw = await prisma.integrationConnection.findUniqueOrThrow({ where: { id: res.body.data.id } });
      expect(raw.encryptedCredentials).not.toBeNull();
      expect(raw.encryptedCredentials).not.toContain('super-secret-tally-key');
    });

    it('writes an INTEGRATION_CONNECTED audit log entry', async () => {
      const token = tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId);
      await request(app).post('/api/v1/integrations/connect').set('Authorization', `Bearer ${token}`).send({ providerKey, credentials: { apiKey: 'x' } });

      const entry = await prisma.auditLog.findFirst({
        where: { tenantId: fixtures.tenantA.tenantId, eventType: 'INTEGRATION_CONNECTED', targetType: 'IntegrationConnection' },
        orderBy: { createdAt: 'desc' },
      });
      expect(entry).not.toBeNull();
    });
  });

  describe('tenant isolation', () => {
    it("tenant B cannot see, disconnect, or sync tenant A's connection", async () => {
      const tokenA = tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId);
      const connectRes = await request(app)
        .post('/api/v1/integrations/connect')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ providerKey, credentials: { apiKey: 'tenant-a-only' } });
      const connectionId = connectRes.body.data.id;

      const tokenB = tokenFor(fixtures.tenantB.tenantId, fixtures.tenantB.userId);
      const listRes = await request(app).get('/api/v1/integrations').set('Authorization', `Bearer ${tokenB}`);
      expect(listRes.body.data.find((c: { id: string }) => c.id === connectionId)).toBeUndefined();

      const disconnectRes = await request(app)
        .post('/api/v1/integrations/disconnect')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ connectionId });
      expect(disconnectRes.status).toBe(404);

      const syncRes = await request(app).post('/api/v1/integrations/sync').set('Authorization', `Bearer ${tokenB}`).send({ connectionId });
      expect(syncRes.status).toBe(404);
    });
  });

  describe('POST /integrations/disconnect', () => {
    it('marks the connection DISCONNECTED', async () => {
      const token = tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId);
      const connectRes = await request(app).post('/api/v1/integrations/connect').set('Authorization', `Bearer ${token}`).send({ providerKey, credentials: { apiKey: 'x' } });

      const res = await request(app)
        .post('/api/v1/integrations/disconnect')
        .set('Authorization', `Bearer ${token}`)
        .send({ connectionId: connectRes.body.data.id });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(IntegrationConnectionStatus.DISCONNECTED);
    });
  });

  describe('GET /integrations/health', () => {
    it('reports unconfigured for a connection with no registered provider', async () => {
      const token = tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId);
      const connectRes = await request(app).post('/api/v1/integrations/connect').set('Authorization', `Bearer ${token}`).send({ providerKey, credentials: { apiKey: 'x' } });

      const res = await request(app)
        .get('/api/v1/integrations/health')
        .query({ connectionId: connectRes.body.data.id })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('unconfigured');
    });
  });

  describe('GET /integrations/sync-history', () => {
    it('returns an empty paginated list before any sync has run', async () => {
      const res = await request(app)
        .get('/api/v1/integrations/sync-history')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantB.tenantId, fixtures.tenantB.userId)}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.meta).toMatchObject({ total: 0 });
    });
  });
});
