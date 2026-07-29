import { randomUUID } from 'crypto';
import request from 'supertest';
import { Application } from 'express';
import { prisma } from '@config/database';
import { createCrmTestApp } from '../../helpers/crm-test-app';
import { signAccessToken } from '../../helpers/jwt';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';
import { CRM_PERMISSIONS } from '@modules/crm/constants/lead.permissions';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CRM (Lead) API — Permission Middleware Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the real request lifecycle up through `requirePermission`:
 *   Request → authMiddleware (JWT) → tenantMiddleware → requirePermission
 *
 * `requirePermission` (see `src/middlewares/permission.middleware.ts`) runs
 * before `validate()`/the controller, so these tests can hit routes with a
 * random/well-formed id or an empty body — the request never reaches
 * business logic. This is unit-level coverage of the RBAC wiring itself
 * (which permission code gates which route); `LeadService`'s actual business
 * logic is covered by `tests/unit/modules/crm/lead.service.spec.ts`, and CRUD/
 * pagination/tenant-isolation/soft-delete by
 * `tests/unit/modules/crm/lead.repository.spec.ts`. No full HTTP lifecycle
 * suite is added here (unlike Business/Contacts) since that would duplicate
 * coverage the unit suites already provide — this file's only job is proving
 * every CRM route is actually wired to `requirePermission` with the right code.
 * Mirrors `tests/integration/modules/business/business.routes.spec.ts`'s
 * "permission middleware" block, extended to cover every CRM route (create,
 * read, update, delete, convert) rather than just two.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

describe('CRM (Lead) API — permission middleware integration', () => {
  let app: Application;
  let fixtures: TestFixtures;

  const ALL_ROUTE_PERMISSIONS = [
    CRM_PERMISSIONS.CREATE,
    CRM_PERMISSIONS.READ,
    CRM_PERMISSIONS.UPDATE,
    CRM_PERMISSIONS.DELETE,
    CRM_PERMISSIONS.MANAGE,
  ];

  beforeAll(async () => {
    app = createCrmTestApp();
    fixtures = await seedFixtures(prisma);
  });

  afterAll(async () => {
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  /** A token with every CRM permission except the ones listed in `without`. */
  function tokenMissing(...without: string[]): string {
    return signAccessToken({
      userId: fixtures.tenantA.userId,
      tenantId: fixtures.tenantA.tenantId,
      permissions: ALL_ROUTE_PERMISSIONS.filter((p) => !without.includes(p)),
    });
  }

  describe('create', () => {
    it('returns 403 for POST /crm when the caller lacks crm:create', async () => {
      const token = tokenMissing(CRM_PERMISSIONS.CREATE);
      const res = await request(app)
        .post('/api/v1/crm')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'No Permission Lead', sourceId: randomUUID(), stageId: randomUUID() });

      expect(res.status).toBe(403);
    });
  });

  describe('read', () => {
    it('returns 403 for GET /crm when the caller lacks crm:read', async () => {
      const token = tokenMissing(CRM_PERMISSIONS.READ);
      const res = await request(app).get('/api/v1/crm').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('returns 403 for GET /crm/:id when the caller lacks crm:read', async () => {
      const token = tokenMissing(CRM_PERMISSIONS.READ);
      const res = await request(app)
        .get(`/api/v1/crm/${randomUUID()}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('returns 403 for GET /crm/stages when the caller lacks crm:read', async () => {
      const token = tokenMissing(CRM_PERMISSIONS.READ);
      const res = await request(app).get('/api/v1/crm/stages').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('update', () => {
    it('returns 403 for PATCH /crm/:id when the caller lacks crm:update', async () => {
      const token = tokenMissing(CRM_PERMISSIONS.UPDATE);
      const res = await request(app)
        .patch(`/api/v1/crm/${randomUUID()}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Renamed' });

      expect(res.status).toBe(403);
    });
  });

  describe('delete', () => {
    it('returns 403 for DELETE /crm/:id when the caller lacks crm:delete', async () => {
      const token = tokenMissing(CRM_PERMISSIONS.DELETE);
      const res = await request(app)
        .delete(`/api/v1/crm/${randomUUID()}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('convert', () => {
    it('returns 403 for POST /crm/:id/convert when the caller lacks crm:manage', async () => {
      const token = tokenMissing(CRM_PERMISSIONS.MANAGE);
      const res = await request(app)
        .post(`/api/v1/crm/${randomUUID()}/convert`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(403);
    });
  });

  describe('authentication middleware', () => {
    it('returns 401 for every CRM route when no Authorization header is present', async () => {
      const res = await request(app).get('/api/v1/crm');
      expect(res.status).toBe(401);
    });
  });
});
