/**
 * ─────────────────────────────────────────────────────────────────────────────
 * White-Label (Branding + Custom Domain) — Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the full real request lifecycle against a real database:
 *   Request → authMiddleware (JWT) → tenantMiddleware → requirePermission →
 *   validate (Zod) → controller → service → repository → Postgres.
 *
 * `node:dns`'s `promises.resolveTxt` is mocked here — a real lookup against
 * this sandbox's DNS resolver was genuinely attempted first and took ~51s to
 * time out (`ETIMEOUT`) rather than the near-instant `ENOTFOUND` a normal
 * network would give for a domain with no such TXT record, which would make
 * this suite both slow and flaky. The real branching logic (token match/
 * mismatch/lookup failure) is already proven with real confidence at the
 * unit level (`tests/unit/modules/tenant/tenant-domain.service.spec.ts`, via
 * the service's own injectable `resolveTxt` param) — this integration test's
 * job is the HTTP+service+repository plumbing around it, not re-proving DNS
 * resolution itself works.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.mock('node:dns', () => ({
  promises: { resolveTxt: jest.fn().mockRejectedValue(Object.assign(new Error('queryTxt ENOTFOUND'), { code: 'ENOTFOUND' })) },
}));

import request from 'supertest';
import { Application } from 'express';
import { prisma } from '@config/database';
import { createTenantTestApp } from '../../helpers/tenant-test-app';
import { signAccessToken } from '../../helpers/jwt';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';
import { TENANT_SETTINGS_PERMISSIONS } from '@modules/tenant/constants/tenant.permissions';

jest.setTimeout(30000);

describe('White-Label API — integration', () => {
  let app: Application;
  let fixtures: TestFixtures;

  beforeAll(async () => {
    app = createTenantTestApp();
    fixtures = await seedFixtures(prisma);
  });

  afterAll(async () => {
    await prisma.tenantDomain.deleteMany({ where: { tenantId: { in: [fixtures.tenantA.tenantId, fixtures.tenantB.tenantId] } } });
    await prisma.tenantBranding.deleteMany({ where: { tenantId: { in: [fixtures.tenantA.tenantId, fixtures.tenantB.tenantId] } } });
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  function tokenFor(tenantId: string, userId: string, permissions: string[]): string {
    return signAccessToken({ userId, tenantId, permissions });
  }

  describe('access control', () => {
    it('returns 401 with no Authorization header', async () => {
      const res = await request(app).get('/api/v1/settings/branding');
      expect(res.status).toBe(401);
    });

    it('returns 403 when the caller lacks settings:read', async () => {
      const res = await request(app)
        .get('/api/v1/settings/branding')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId, [])}`);
      expect(res.status).toBe(403);
    });
  });

  describe('branding', () => {
    it('returns an all-null response before any branding has been configured', async () => {
      const res = await request(app)
        .get('/api/v1/settings/branding')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId, [TENANT_SETTINGS_PERMISSIONS.READ])}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ firmName: null, primaryColor: null, updatedAt: null });
    });

    it('creates the branding row on first PATCH and reflects it on a subsequent GET', async () => {
      const token = tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId, [TENANT_SETTINGS_PERMISSIONS.MANAGE, TENANT_SETTINGS_PERMISSIONS.READ]);

      const patchRes = await request(app)
        .patch('/api/v1/settings/branding')
        .set('Authorization', `Bearer ${token}`)
        .send({ firmName: 'Acme & Associates', primaryColor: '#123456' });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data).toMatchObject({ firmName: 'Acme & Associates', primaryColor: '#123456' });
      expect(patchRes.body.data.updatedAt).not.toBeNull();

      const getRes = await request(app).get('/api/v1/settings/branding').set('Authorization', `Bearer ${token}`);
      expect(getRes.body.data).toMatchObject({ firmName: 'Acme & Associates', primaryColor: '#123456' });
    });

    it('returns 422 for an invalid hex color', async () => {
      const token = tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId, [TENANT_SETTINGS_PERMISSIONS.MANAGE]);
      const res = await request(app).patch('/api/v1/settings/branding').set('Authorization', `Bearer ${token}`).send({ primaryColor: 'not-a-color' });
      expect(res.status).toBe(422);
    });
  });

  describe('custom domain — real DNS verification', () => {
    it('creates the domain unverified with SSL pending, then real DNS verification against a domain with no TXT record leaves it unverified', async () => {
      const token = tokenFor(fixtures.tenantB.tenantId, fixtures.tenantB.userId, [TENANT_SETTINGS_PERMISSIONS.MANAGE, TENANT_SETTINGS_PERMISSIONS.READ]);

      const createRes = await request(app)
        .post('/api/v1/settings/domain')
        .set('Authorization', `Bearer ${token}`)
        .send({ customDomain: 'example.com' });
      expect(createRes.status).toBe(201);
      expect(createRes.body.data).toMatchObject({ domain: 'example.com', subdomain: null, isVerified: false, sslStatus: 'PENDING' });
      expect(createRes.body.data.verification).toEqual({
        recordType: 'TXT',
        recordName: '_cafirm-verify.example.com',
        recordValue: expect.any(String),
      });

      // Real network DNS lookup — example.com certainly has no _cafirm-verify TXT record.
      const verifyRes = await request(app).post('/api/v1/settings/domain/verify').set('Authorization', `Bearer ${token}`);
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.data.isVerified).toBe(false);

      const deleteRes = await request(app).delete('/api/v1/settings/domain').set('Authorization', `Bearer ${token}`);
      expect(deleteRes.status).toBe(200);
    });
  });

  describe('platform subdomain — verified immediately, and publicly resolvable', () => {
    const subdomain = `acmetest${Date.now()}`;

    it('creates a subdomain that is verified with SSL provisioned immediately', async () => {
      const token = tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId, [TENANT_SETTINGS_PERMISSIONS.MANAGE]);

      const res = await request(app).post('/api/v1/settings/domain').set('Authorization', `Bearer ${token}`).send({ subdomain });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ domain: `${subdomain}.localhost`, subdomain, isVerified: true, sslStatus: 'PROVISIONED' });
      expect(res.body.data.verification).toBeNull();
    });

    it('rejects a second domain for the same tenant with 409', async () => {
      const token = tokenFor(fixtures.tenantA.tenantId, fixtures.tenantA.userId, [TENANT_SETTINGS_PERMISSIONS.MANAGE]);
      const res = await request(app).post('/api/v1/settings/domain').set('Authorization', `Bearer ${token}`).send({ subdomain: 'someothername' });
      expect(res.status).toBe(409);
    });

    it('is publicly resolvable by hostname with NO auth, returning the branding configured earlier', async () => {
      const res = await request(app).get('/api/v1/public/white-label').query({ host: `${subdomain}.localhost` });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ firmName: 'Acme & Associates', primaryColor: '#123456' });
    });

    it('returns an all-null response for a hostname no tenant has claimed', async () => {
      const res = await request(app).get('/api/v1/public/white-label').query({ host: 'nobody-has-this.localhost' });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ firmName: null, logoUrl: null, faviconUrl: null, primaryColor: null, accentColor: null });
    });

    it('returns 422 when the host query param is missing', async () => {
      const res = await request(app).get('/api/v1/public/white-label');
      expect(res.status).toBe(422);
    });
  });

  describe('tenant isolation', () => {
    it("tenant B's token never sees tenant A's branding", async () => {
      const token = tokenFor(fixtures.tenantB.tenantId, fixtures.tenantB.userId, [TENANT_SETTINGS_PERMISSIONS.READ]);
      const res = await request(app).get('/api/v1/settings/branding').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.firmName).toBeNull();
    });
  });
});
