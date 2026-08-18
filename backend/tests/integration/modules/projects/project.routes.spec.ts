import { randomUUID } from 'crypto';
import request from 'supertest';
import { Application } from 'express';
import { ProjectStatus } from '@prisma/client';
import { prisma } from '@config/database';
import { createTestApp } from '../../helpers/test-app';
import { signAccessToken } from '../../helpers/jwt';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';
import { PROJECT_PERMISSIONS } from '@modules/projects/constants/project.permissions';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Projects API — Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the full real request lifecycle against a real database:
 *   Request → authMiddleware (JWT) → tenantMiddleware → requirePermission →
 *   validate (Zod) → ProjectController → ProjectService → ProjectRepository →
 *   Postgres
 *
 * Nothing here is mocked — `createTestApp()` wires the real middleware and
 * the real `project.routes.ts`, and fixtures are real rows inserted via the
 * real Prisma client. This requires a reachable, migrated database at
 * `DATABASE_URL`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

describe('Projects API — integration', () => {
  let app: Application;
  let fixtures: TestFixtures;

  const allPermissions = Object.values(PROJECT_PERMISSIONS);

  beforeAll(async () => {
    app = createTestApp();
    fixtures = await seedFixtures(prisma);
  });

  afterAll(async () => {
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  function tokenForTenantA(permissions: string[] = allPermissions): string {
    return signAccessToken({
      userId: fixtures.tenantA.userId,
      tenantId: fixtures.tenantA.tenantId,
      permissions,
    });
  }

  function tokenForTenantB(permissions: string[] = allPermissions): string {
    return signAccessToken({
      userId: fixtures.tenantB.userId,
      tenantId: fixtures.tenantB.tenantId,
      permissions,
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Authentication middleware — 401
  // ────────────────────────────────────────────────────────────────────────
  describe('authentication middleware', () => {
    it('returns 401 when no Authorization header is present', async () => {
      const res = await request(app).get('/api/v1/projects');
      expect(res.status).toBe(401);
    });

    it('returns 401 for a malformed/invalid token', async () => {
      const res = await request(app)
        .get('/api/v1/projects')
        .set('Authorization', 'Bearer not-a-real-token');
      expect(res.status).toBe(401);
    });

    it('returns 401 for an expired token', async () => {
      const expiredToken = signAccessToken({
        userId: fixtures.tenantA.userId,
        tenantId: fixtures.tenantA.tenantId,
        permissions: allPermissions,
        expiresInSeconds: -10,
      });

      const res = await request(app)
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(res.status).toBe(401);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Permission middleware — 403
  // ────────────────────────────────────────────────────────────────────────
  describe('permission middleware', () => {
    it('returns 403 when the caller is authenticated but lacks projects:create', async () => {
      const token = tokenForTenantA([]); // valid tenant/user, zero permissions
      const res = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ clientId: fixtures.tenantA.clientId, code: 'NO-PERM-1', name: 'No Permission' });

      expect(res.status).toBe(403);
    });

    it('returns 403 when the caller lacks projects:manage for archive', async () => {
      const token = tokenForTenantA([PROJECT_PERMISSIONS.READ]);
      const res = await request(app)
        .post(`/api/v1/projects/${randomUUID()}/archive`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Validation middleware
  // ────────────────────────────────────────────────────────────────────────
  describe('validation middleware', () => {
    it('returns 422 when required fields are missing from the body', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Missing clientId and code' });

      expect(res.status).toBe(422);
    });

    it('returns 422 for an invalid path param (non-UUID id)', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .get('/api/v1/projects/not-a-uuid')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(422);
    });

    // Documents actual current behavior rather than the ideal one: this
    // module never throws BadRequestError (400) anywhere, and a raw
    // body-parser SyntaxError from malformed JSON doesn't match any of
    // errorMiddleware's recognized branches (AppError / ZodError / Prisma
    // error), so it falls through to the generic 500 handler instead of a
    // clean 400. Flagging as a pre-existing gap in shared error middleware,
    // not something introduced or fixed here.
    it('returns 500 (not 400) for a malformed JSON body — pre-existing error-middleware gap', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/json')
        .send('{ this is not valid json');

      expect(res.status).toBe(500);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Full lifecycle — 201, 200, 409, 404
  // ────────────────────────────────────────────────────────────────────────
  describe('full lifecycle', () => {
    let projectId: string;

    it('POST /projects returns 201 and creates the project in DRAFT', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ clientId: fixtures.tenantA.clientId, code: 'LIFECYCLE-1', name: 'Lifecycle Project' });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ code: 'LIFECYCLE-1', status: ProjectStatus.DRAFT });
      projectId = res.body.data.id;
    });

    it('POST /projects returns 409 for a duplicate code', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ clientId: fixtures.tenantA.clientId, code: 'LIFECYCLE-1', name: 'Duplicate code' });

      expect(res.status).toBe(409);
    });

    it('GET /projects/:id returns 200 with the project', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(projectId);
    });

    it('GET /projects/:id returns 404 for a well-formed but unknown id', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .get(`/api/v1/projects/${randomUUID()}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('GET /projects/code/:code returns 200', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .get('/api/v1/projects/code/LIFECYCLE-1')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(projectId);
    });

    it('PATCH /projects/:id returns 200 and updates the project', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .patch(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Lifecycle Project (renamed)' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Lifecycle Project (renamed)');
    });

    it('PATCH /projects/:id/status DRAFT → PLANNED returns 200', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .patch(`/api/v1/projects/${projectId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: ProjectStatus.PLANNED });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(ProjectStatus.PLANNED);
    });

    it('PATCH /projects/:id/status PLANNED → ACTIVE returns 200', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .patch(`/api/v1/projects/${projectId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: ProjectStatus.ACTIVE });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(ProjectStatus.ACTIVE);
    });

    it('PATCH /projects/:id/status ACTIVE → DRAFT returns 409 (illegal transition)', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .patch(`/api/v1/projects/${projectId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: ProjectStatus.DRAFT });

      expect(res.status).toBe(409);
    });

    it('PATCH /projects/:id/status ACTIVE → COMPLETED returns 200', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .patch(`/api/v1/projects/${projectId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: ProjectStatus.COMPLETED });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(ProjectStatus.COMPLETED);
      expect(res.body.data.completedAt).not.toBeNull();
    });

    it('POST /projects/:id/archive returns 200 and archives the project', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/archive`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(ProjectStatus.ARCHIVED);
    });

    it('PATCH /projects/:id returns 409 once archived (read-only)', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .patch(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Should be rejected' });

      expect(res.status).toBe(409);
    });

    it('DELETE /projects/:id returns 409 for an archived (non-deletable) project', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .delete(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(409);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Tenant isolation
  // ────────────────────────────────────────────────────────────────────────
  describe('tenant isolation', () => {
    let tenantAProjectId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ clientId: fixtures.tenantA.clientId, code: 'ISOLATION-1', name: 'Tenant A Only' });
      expect(res.status).toBe(201);
      tenantAProjectId = res.body.data.id;
    });

    it("returns 404 when tenant B requests tenant A's project by id", async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${tenantAProjectId}`)
        .set('Authorization', `Bearer ${tokenForTenantB()}`);

      expect(res.status).toBe(404);
    });

    it("does not include tenant A's project in tenant B's list", async () => {
      const res = await request(app)
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${tokenForTenantB()}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((p: { id: string }) => p.id);
      expect(ids).not.toContain(tenantAProjectId);
    });

    it("tenant A can still fetch its own project", async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${tenantAProjectId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);

      expect(res.status).toBe(200);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Soft delete
  // ────────────────────────────────────────────────────────────────────────
  describe('soft delete', () => {
    let deletableProjectId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${tokenForTenantA()}`)
        .send({ clientId: fixtures.tenantA.clientId, code: 'SOFTDELETE-1', name: 'Soft Delete Me' });
      expect(res.status).toBe(201);
      deletableProjectId = res.body.data.id;
    });

    it('DELETE /projects/:id returns 200 while the project is DRAFT', async () => {
      const res = await request(app)
        .delete(`/api/v1/projects/${deletableProjectId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);

      expect(res.status).toBe(200);
    });

    it('GET /projects/:id returns 404 once soft-deleted (excluded by default)', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${deletableProjectId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);

      expect(res.status).toBe(404);
    });

    it('POST /projects/:id/restore returns 200 and reverses the soft delete', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${deletableProjectId}/restore`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);

      expect(res.status).toBe(200);
    });

    it('GET /projects/:id returns 200 again after restore', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${deletableProjectId}`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);

      expect(res.status).toBe(200);
    });

    it('POST /projects/:id/restore returns 409 when the project is not deleted', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${deletableProjectId}/restore`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);

      expect(res.status).toBe(409);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Pagination
  // ────────────────────────────────────────────────────────────────────────
  describe('pagination', () => {
    beforeAll(async () => {
      const token = tokenForTenantA();
      for (let i = 1; i <= 3; i++) {
        // eslint-disable-next-line no-await-in-loop
        const res = await request(app)
          .post('/api/v1/projects')
          .set('Authorization', `Bearer ${token}`)
          .send({ clientId: fixtures.tenantA.clientId, code: `PAGINATION-${i}`, name: `Pagination ${i}` });
        expect(res.status).toBe(201);
      }
    });

    it('honors page/limit and reports correct pagination metadata', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .get('/api/v1/projects')
        .query({ page: 1, limit: 2, search: 'PAGINATION' })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2, hasNextPage: true });
    });

    it('returns the remaining record on page 2', async () => {
      const token = tokenForTenantA();
      const res = await request(app)
        .get('/api/v1/projects')
        .query({ page: 2, limit: 2, search: 'PAGINATION' })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta).toMatchObject({ page: 2, hasNextPage: false, hasPrevPage: true });
    });
  });
});
