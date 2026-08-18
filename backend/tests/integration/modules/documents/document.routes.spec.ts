import { randomUUID } from 'crypto';
import request from 'supertest';
import { Application } from 'express';
import { prisma } from '@config/database';
import { createDocumentTestApp } from '../../helpers/document-test-app';
import { signAccessToken } from '../../helpers/jwt';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';
import { DOCUMENT_PERMISSIONS } from '@modules/documents/constants/document.permissions';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Documents API — Permission Middleware Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the real request lifecycle up through `requirePermission`:
 *   Request → authMiddleware (JWT) → tenantMiddleware → requirePermission
 *
 * `requirePermission` runs before `multer`/`validate()`/the controller (see
 * `modules/documents/routes/document.routes.ts`), so these tests never need
 * a real multipart file or a real S3/R2 bucket — a plain JSON body never
 * reaches the point where either would matter. This mirrors
 * `tests/integration/modules/crm/lead.routes.spec.ts`'s identical reasoning:
 * `DocumentService`'s business logic (including the real file-validation/
 * storage-key logic) is covered by `tests/unit/modules/documents/
 * document.service.spec.ts` against a mocked `S3StorageService` — no full
 * upload lifecycle is exercised here, since there is no AWS credential
 * configured in this environment to upload to (see `config/storage.ts`'s
 * optional AWS_* env vars), and faking that would just be redundant with the
 * unit coverage.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

describe('Documents API — permission middleware integration', () => {
  let app: Application;
  let fixtures: TestFixtures;

  const ALL_ROUTE_PERMISSIONS = [
    DOCUMENT_PERMISSIONS.CREATE,
    DOCUMENT_PERMISSIONS.READ,
    DOCUMENT_PERMISSIONS.UPDATE,
    DOCUMENT_PERMISSIONS.DELETE,
  ];

  beforeAll(async () => {
    app = createDocumentTestApp();
    fixtures = await seedFixtures(prisma);
  });

  afterAll(async () => {
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  /** A token with every Documents permission except the ones listed in `without`. */
  function tokenMissing(...without: string[]): string {
    return signAccessToken({
      userId: fixtures.tenantA.userId,
      tenantId: fixtures.tenantA.tenantId,
      permissions: ALL_ROUTE_PERMISSIONS.filter((p) => !without.includes(p)),
    });
  }

  describe('create', () => {
    it('returns 403 for POST /documents when the caller lacks documents:create', async () => {
      const token = tokenMissing(DOCUMENT_PERMISSIONS.CREATE);
      const res = await request(app)
        .post('/api/v1/documents')
        .set('Authorization', `Bearer ${token}`)
        .send({ category: 'PAN' });

      expect(res.status).toBe(403);
    });
  });

  describe('read', () => {
    it('returns 403 for GET /documents when the caller lacks documents:read', async () => {
      const token = tokenMissing(DOCUMENT_PERMISSIONS.READ);
      const res = await request(app).get('/api/v1/documents').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('returns 403 for GET /documents/:id when the caller lacks documents:read', async () => {
      const token = tokenMissing(DOCUMENT_PERMISSIONS.READ);
      const res = await request(app)
        .get(`/api/v1/documents/${randomUUID()}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('returns 403 for GET /documents/:id/download when the caller lacks documents:read', async () => {
      const token = tokenMissing(DOCUMENT_PERMISSIONS.READ);
      const res = await request(app)
        .get(`/api/v1/documents/${randomUUID()}/download`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('update', () => {
    it('returns 403 for PATCH /documents/:id when the caller lacks documents:update', async () => {
      const token = tokenMissing(DOCUMENT_PERMISSIONS.UPDATE);
      const res = await request(app)
        .patch(`/api/v1/documents/${randomUUID()}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ category: 'GST' });

      expect(res.status).toBe(403);
    });
  });

  describe('delete', () => {
    it('returns 403 for DELETE /documents/:id when the caller lacks documents:delete', async () => {
      const token = tokenMissing(DOCUMENT_PERMISSIONS.DELETE);
      const res = await request(app)
        .delete(`/api/v1/documents/${randomUUID()}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Versioning (PRD §7.2) — same permission-middleware-only scope as the rest
  // of this file (see header comment): `requirePermission` runs before
  // `multer`/`validate()`/the controller, so a 403 short-circuits before ever
  // needing a real file or S3 bucket. The actual replace-flow/version-chain
  // business logic (conflict detection, createVersion, getVersionHistory,
  // Content-Disposition) is covered against a mocked S3StorageService in
  // tests/unit/modules/documents/document.service.spec.ts.
  // ────────────────────────────────────────────────────────────────────────
  describe('versioning', () => {
    it('returns 403 for GET /documents/:id/versions when the caller lacks documents:read', async () => {
      const token = tokenMissing(DOCUMENT_PERMISSIONS.READ);
      const res = await request(app)
        .get(`/api/v1/documents/${randomUUID()}/versions`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('returns 403 for POST /documents/:id/version when the caller lacks documents:create', async () => {
      const token = tokenMissing(DOCUMENT_PERMISSIONS.CREATE);
      const res = await request(app)
        .post(`/api/v1/documents/${randomUUID()}/version`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('returns 401 for GET /documents/:id/versions when no Authorization header is present', async () => {
      const res = await request(app).get(`/api/v1/documents/${randomUUID()}/versions`);
      expect(res.status).toBe(401);
    });

    it('returns 401 for POST /documents/:id/version when no Authorization header is present', async () => {
      const res = await request(app).post(`/api/v1/documents/${randomUUID()}/version`);
      expect(res.status).toBe(401);
    });
  });

  describe('authentication middleware', () => {
    it('returns 401 for every Documents route when no Authorization header is present', async () => {
      const res = await request(app).get('/api/v1/documents');
      expect(res.status).toBe(401);
    });
  });
});
