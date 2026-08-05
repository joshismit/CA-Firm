import request from 'supertest';
import { Application } from 'express';
import { prisma } from '@config/database';
import { UserRole } from '@shared/enums';
import { createDocumentTestApp } from '../../helpers/document-test-app';
import { signAccessToken } from '../../helpers/jwt';
import { seedAccessScopeFixtures, cleanupAccessScopeFixtures, AccessScopeFixtures } from '../../helpers/access-scope-fixtures';
import { DOCUMENT_PERMISSIONS } from '@modules/documents/constants/document.permissions';
import { HR_PERMISSION_CODES } from '@modules/roles/constants/extended-roles.constants';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PRD 6.2 — Document Permission Philosophy: Accountant / Auditor / Client / HR
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the full request lifecycle — including `DocumentAccessScopeService`,
 * which `document.routes.spec.ts` never reaches since it only asserts 403s at
 * the `requirePermission()` layer before any Document rows exist. Every token
 * here already carries the permission the route needs (`documents:read`/
 * `documents:share`); what's under test is the *additional* Business/category/
 * Contact-based restriction layered on top by `DocumentService`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

describe('Documents API — access scope integration (PRD 6.2)', () => {
  let app: Application;
  let fx: AccessScopeFixtures;

  beforeAll(async () => {
    app = createDocumentTestApp();
    fx = await seedAccessScopeFixtures(prisma);
  });

  afterAll(async () => {
    await cleanupAccessScopeFixtures(prisma, fx);
    await prisma.$disconnect();
  });

  function tokenFor(userId: string, opts: { role?: UserRole; permissions?: string[] } = {}): string {
    return signAccessToken({
      userId,
      tenantId: fx.tenantId,
      role: opts.role ?? UserRole.STAFF,
      permissions: opts.permissions ?? [DOCUMENT_PERMISSIONS.READ],
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Accountant — scoped to assigned Businesses only
  // ────────────────────────────────────────────────────────────────────────
  describe('Accountant', () => {
    it('returns 200 for a document belonging to their assigned Business', async () => {
      const token = tokenFor(fx.accountantUserId);
      const res = await request(app)
        .get(`/api/v1/documents/${fx.documentInBusinessA}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('returns 403 for a document belonging to an unassigned Business', async () => {
      const token = tokenFor(fx.accountantUserId);
      const res = await request(app)
        .get(`/api/v1/documents/${fx.documentInBusinessB}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('list only returns documents from the assigned Business', async () => {
      const token = tokenFor(fx.accountantUserId);
      const res = await request(app).get('/api/v1/documents').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const ids: string[] = res.body.data.map((d: { id: string }) => d.id);
      expect(ids).toContain(fx.documentInBusinessA);
      expect(ids).not.toContain(fx.documentInBusinessB);
      expect(ids).not.toContain(fx.auditDocumentInBusinessB);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Auditor — scoped to the AUDIT category only
  // ────────────────────────────────────────────────────────────────────────
  describe('Auditor', () => {
    it('returns 200 for an AUDIT-category document, regardless of Business', async () => {
      const token = tokenFor(fx.auditorUserId);
      const res = await request(app)
        .get(`/api/v1/documents/${fx.auditDocumentInBusinessB}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('returns 403 for a non-AUDIT document', async () => {
      const token = tokenFor(fx.auditorUserId);
      const res = await request(app)
        .get(`/api/v1/documents/${fx.documentInBusinessA}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('list only returns AUDIT-category documents', async () => {
      const token = tokenFor(fx.auditorUserId);
      const res = await request(app).get('/api/v1/documents').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const categories: string[] = res.body.data.map((d: { category: string }) => d.category);
      expect(categories.every((c) => c === 'AUDIT')).toBe(true);
      const ids: string[] = res.body.data.map((d: { id: string }) => d.id);
      expect(ids).toContain(fx.auditDocumentInBusinessB);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Client (portal) — scoped to their own Business/Documents
  // ────────────────────────────────────────────────────────────────────────
  describe('Client', () => {
    it('returns 200 for a document belonging to their own Business (via ContactRole)', async () => {
      const token = tokenFor(fx.clientPortalUserId, { role: UserRole.CLIENT });
      const res = await request(app)
        .get(`/api/v1/documents/${fx.documentInBusinessA}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('returns 200 for their own contactId-linked document (no Business)', async () => {
      const token = tokenFor(fx.clientPortalUserId, { role: UserRole.CLIENT });
      const res = await request(app)
        .get(`/api/v1/documents/${fx.clientPersonalDocumentId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('returns 403 for a document outside their Business/Contact scope', async () => {
      const token = tokenFor(fx.clientPortalUserId, { role: UserRole.CLIENT });
      const res = await request(app)
        .get(`/api/v1/documents/${fx.documentInBusinessB}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('list only returns documents within their own Business/Contact scope', async () => {
      const token = tokenFor(fx.clientPortalUserId, { role: UserRole.CLIENT });
      const res = await request(app).get('/api/v1/documents').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const ids: string[] = res.body.data.map((d: { id: string }) => d.id);
      expect(ids.sort()).toEqual([fx.clientPersonalDocumentId, fx.documentInBusinessA].sort());
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // HR — no document permissions at all (seeded role, not ad-hoc scoping)
  // ────────────────────────────────────────────────────────────────────────
  describe('HR', () => {
    it('returns 403 for GET /documents with exactly the seeded HR permission set', async () => {
      const token = tokenFor(fx.outsiderUserId, { permissions: HR_PERMISSION_CODES });
      const res = await request(app).get('/api/v1/documents').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('the seeded HR permission set contains no documents:* code', () => {
      expect(HR_PERMISSION_CODES.some((code) => code.startsWith('documents:'))).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Share — bypasses the recipient's normal scope for that one document
  // ────────────────────────────────────────────────────────────────────────
  describe('share', () => {
    it('returns 403 for POST /:id/share without the documents:share permission', async () => {
      const token = tokenFor(fx.accountantUserId, { permissions: [DOCUMENT_PERMISSIONS.READ] });
      const res = await request(app)
        .post(`/api/v1/documents/${fx.documentInBusinessA}/share`)
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: fx.outsiderUserId });

      expect(res.status).toBe(403);
    });

    it('a shared document becomes visible to the recipient even outside their normal scope', async () => {
      // Sanity check: before sharing, the outsider (an Accountant assigned to Business B only) cannot see Business A's document.
      const outsiderToken = tokenFor(fx.outsiderUserId);
      const before = await request(app)
        .get(`/api/v1/documents/${fx.documentInBusinessA}`)
        .set('Authorization', `Bearer ${outsiderToken}`);
      expect(before.status).toBe(403);

      const sharerToken = tokenFor(fx.accountantUserId, {
        permissions: [DOCUMENT_PERMISSIONS.READ, DOCUMENT_PERMISSIONS.SHARE],
      });
      const shareRes = await request(app)
        .post(`/api/v1/documents/${fx.documentInBusinessA}/share`)
        .set('Authorization', `Bearer ${sharerToken}`)
        .send({ userId: fx.outsiderUserId });
      expect(shareRes.status).toBe(200);

      const after = await request(app)
        .get(`/api/v1/documents/${fx.documentInBusinessA}`)
        .set('Authorization', `Bearer ${outsiderToken}`);
      expect(after.status).toBe(200);
    });
  });
});
