import request from 'supertest';
import { Application } from 'express';
import { prisma } from '@config/database';
import { createTenantTestApp } from '../../helpers/tenant-test-app';
import { signAccessToken } from '../../helpers/jwt';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';
import { TENANT_SETTINGS_PERMISSIONS } from '@modules/tenant/constants/tenant.permissions';
import { UPLOAD } from '@shared/constants';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Firm Storage Settings API (PRD §7.4) — Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the full real request lifecycle against a real database:
 *   Request → authMiddleware (JWT) → tenantMiddleware → requirePermission →
 *   validate (Zod) → StorageSettingsController → TenantStorageSettingsService
 *   → TenantStorageSettingsRepository → Postgres.
 *
 * Mirrors `tests/integration/modules/tenant/white-label.routes.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

describe('Firm Storage Settings API — integration', () => {
  let app: Application;
  let fixtures: TestFixtures;

  beforeAll(async () => {
    app = createTenantTestApp();
    fixtures = await seedFixtures(prisma);
  });

  afterAll(async () => {
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  function tokenFor(tenantId: string, userId: string, permissions: string[]): string {
    return signAccessToken({ userId, tenantId, permissions });
  }

  describe('access control', () => {
    it('returns 401 with no Authorization header', async () => {
      const res = await request(app).get('/api/v1/settings/storage');
      expect(res.status).toBe(401);
    });

    it('returns 403 when the caller lacks settings:read', async () => {
      const res = await request(app)
        .get('/api/v1/settings/storage')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId, [])}`);
      expect(res.status).toBe(403);
    });

    it('returns 403 for PATCH when the caller lacks settings:manage', async () => {
      const res = await request(app)
        .patch('/api/v1/settings/storage')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId, [TENANT_SETTINGS_PERMISSIONS.READ])}`)
        .send({ defaultBusinessStorageQuotaMb: 1000 });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /settings/storage', () => {
    it('reports the global default max upload size (100 MB) when the tenant has no plan override', async () => {
      const res = await request(app)
        .get('/api/v1/settings/storage')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId, [TENANT_SETTINGS_PERMISSIONS.READ])}`);

      expect(res.status).toBe(200);
      expect(res.body.data.maxUploadSizeMb).toBe(UPLOAD.DEFAULT_MAX_FILE_SIZE_BYTES / (1024 * 1024));
      expect(res.body.data.defaultBusinessStorageQuotaMb).toBeNull();
    });

    it("reflects the tenant's plan-derived maxUploadSizeMb when a master admin has set one", async () => {
      await prisma.tenant.update({ where: { id: fixtures.tenantA.tenantId }, data: { maxUploadSizeMb: 250 } });

      const res = await request(app)
        .get('/api/v1/settings/storage')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId, [TENANT_SETTINGS_PERMISSIONS.READ])}`);

      expect(res.status).toBe(200);
      expect(res.body.data.maxUploadSizeMb).toBe(250);

      await prisma.tenant.update({ where: { id: fixtures.tenantA.tenantId }, data: { maxUploadSizeMb: null } });
    });
  });

  describe('PATCH /settings/storage', () => {
    it('updates defaultBusinessStorageQuotaMb, reflected on a subsequent GET, and writes an audit log entry', async () => {
      const token = tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId, [TENANT_SETTINGS_PERMISSIONS.READ, TENANT_SETTINGS_PERMISSIONS.MANAGE]);

      const patchRes = await request(app)
        .patch('/api/v1/settings/storage')
        .set('Authorization', `Bearer ${token}`)
        .send({ defaultBusinessStorageQuotaMb: 1000 });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.defaultBusinessStorageQuotaMb).toBe(1000);

      const getRes = await request(app)
        .get('/api/v1/settings/storage')
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.body.data.defaultBusinessStorageQuotaMb).toBe(1000);

      const auditEntry = await prisma.auditLog.findFirst({
        where: { tenantId: fixtures.tenantA.tenantId, eventType: 'SETTINGS_UPDATE', targetType: 'TenantSettings' },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditEntry).not.toBeNull();
    });

    it('rejects a quota below the 1 MB minimum with 422', async () => {
      const token = tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId, [TENANT_SETTINGS_PERMISSIONS.MANAGE]);

      const res = await request(app)
        .patch('/api/v1/settings/storage')
        .set('Authorization', `Bearer ${token}`)
        .send({ defaultBusinessStorageQuotaMb: 0 });

      expect(res.status).toBe(422);
    });

    it('can reset to the global default by sending null', async () => {
      const token = tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId, [TENANT_SETTINGS_PERMISSIONS.READ, TENANT_SETTINGS_PERMISSIONS.MANAGE]);
      await request(app).patch('/api/v1/settings/storage').set('Authorization', `Bearer ${token}`).send({ defaultBusinessStorageQuotaMb: 1000 });

      const res = await request(app)
        .patch('/api/v1/settings/storage')
        .set('Authorization', `Bearer ${token}`)
        .send({ defaultBusinessStorageQuotaMb: null });

      expect(res.status).toBe(200);
      expect(res.body.data.defaultBusinessStorageQuotaMb).toBeNull();
    });
  });

  describe('tenant isolation', () => {
    it("tenant B's default quota is unaffected by tenant A's settings", async () => {
      const tokenA = tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId, [TENANT_SETTINGS_PERMISSIONS.MANAGE]);
      await request(app).patch('/api/v1/settings/storage').set('Authorization', `Bearer ${tokenA}`).send({ defaultBusinessStorageQuotaMb: 2000 });

      const tokenB = tokenFor(fixtures.tenantB.tenantId, fixtures.tenantB.userId, [TENANT_SETTINGS_PERMISSIONS.READ]);
      const res = await request(app).get('/api/v1/settings/storage').set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.data.defaultBusinessStorageQuotaMb).toBeNull();
    });
  });
});
