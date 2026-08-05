import { randomUUID } from 'crypto';
import request from 'supertest';
import { Application } from 'express';
import { DocumentCategory } from '@prisma/client';
import { prisma } from '@config/database';
import { createDocumentTestApp } from '../../helpers/document-test-app';
import { signAccessToken } from '../../helpers/jwt';
import { seedDocumentFolderFixtures, cleanupDocumentFolderFixtures, DocumentFolderFixtures } from '../../helpers/document-folder-fixtures';
import { DOCUMENT_PERMISSIONS } from '@modules/documents/constants/document.permissions';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Document Folders API — Integration Tests (PRD §7.1)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the real request lifecycle — authMiddleware → tenantMiddleware →
 * requirePermission → validate → controller → service → repository — against
 * a real Postgres database. Mirrors `document.routes.spec.ts` (permission
 * checks) and `document-access-scope.routes.spec.ts` (full-lifecycle
 * coverage), applied to the new folder routes.
 *
 * No multipart upload here — `document.routes.spec.ts`'s header comment
 * explains why real S3 upload isn't exercised in this environment (no AWS
 * credentials configured); "upload-to-folder" (folderId → businessId
 * auto-fill, folder/category consistency) is instead unit-tested in
 * `tests/unit/modules/documents/document.service.spec.ts`'s "folder
 * consistency" block. "Search-by-folder" below seeds `Document` rows
 * directly via Prisma (exactly like `prisma/seeds/dev-data.seed.ts` does —
 * "metadata only, no file actually uploaded to storage") and exercises the
 * real `GET /documents?folderId=` route on top of that data.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

describe('Document Folders API', () => {
  let app: Application;
  let fx: DocumentFolderFixtures;

  const ALL_FOLDER_PERMISSIONS = [
    DOCUMENT_PERMISSIONS.CREATE,
    DOCUMENT_PERMISSIONS.READ,
    DOCUMENT_PERMISSIONS.UPDATE,
    DOCUMENT_PERMISSIONS.DELETE,
  ];

  beforeAll(async () => {
    app = createDocumentTestApp();
    fx = await seedDocumentFolderFixtures(prisma);
  });

  afterAll(async () => {
    await cleanupDocumentFolderFixtures(prisma, fx);
    await prisma.$disconnect();
  });

  function fullToken(): string {
    return signAccessToken({ userId: fx.userId, tenantId: fx.tenantId, permissions: ALL_FOLDER_PERMISSIONS });
  }

  function tokenMissing(...without: string[]): string {
    return signAccessToken({
      userId: fx.userId,
      tenantId: fx.tenantId,
      permissions: ALL_FOLDER_PERMISSIONS.filter((p) => !without.includes(p)),
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Permission middleware
  // ────────────────────────────────────────────────────────────────────────
  describe('permission middleware', () => {
    it('returns 403 for POST .../folders when the caller lacks documents:create', async () => {
      const res = await request(app)
        .post(`/api/v1/documents/businesses/${fx.businessId}/folders`)
        .set('Authorization', `Bearer ${tokenMissing(DOCUMENT_PERMISSIONS.CREATE)}`)
        .send({ category: DocumentCategory.PAN, name: 'Test Folder' });

      expect(res.status).toBe(403);
    });

    it('returns 403 for GET .../folders when the caller lacks documents:read', async () => {
      const res = await request(app)
        .get(`/api/v1/documents/businesses/${fx.businessId}/folders`)
        .set('Authorization', `Bearer ${tokenMissing(DOCUMENT_PERMISSIONS.READ)}`);

      expect(res.status).toBe(403);
    });

    it('returns 403 for GET /folders/:id when the caller lacks documents:read', async () => {
      const res = await request(app)
        .get(`/api/v1/documents/folders/${randomUUID()}`)
        .set('Authorization', `Bearer ${tokenMissing(DOCUMENT_PERMISSIONS.READ)}`);

      expect(res.status).toBe(403);
    });

    it('returns 403 for PATCH /folders/:id when the caller lacks documents:update', async () => {
      const res = await request(app)
        .patch(`/api/v1/documents/folders/${randomUUID()}`)
        .set('Authorization', `Bearer ${tokenMissing(DOCUMENT_PERMISSIONS.UPDATE)}`)
        .send({ name: 'Renamed' });

      expect(res.status).toBe(403);
    });

    it('returns 403 for DELETE /folders/:id when the caller lacks documents:delete', async () => {
      const res = await request(app)
        .delete(`/api/v1/documents/folders/${randomUUID()}`)
        .set('Authorization', `Bearer ${tokenMissing(DOCUMENT_PERMISSIONS.DELETE)}`);

      expect(res.status).toBe(403);
    });

    it('returns 401 for every folder route when no Authorization header is present', async () => {
      const res = await request(app).get(`/api/v1/documents/businesses/${fx.businessId}/folders`);
      expect(res.status).toBe(401);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Hierarchy (adjacency list — PRD §7.1 rule 3)
  // ────────────────────────────────────────────────────────────────────────
  describe('hierarchy', () => {
    it('returns 404 when the Business does not exist', async () => {
      const res = await request(app)
        .post(`/api/v1/documents/businesses/${randomUUID()}/folders`)
        .set('Authorization', `Bearer ${fullToken()}`)
        .send({ category: DocumentCategory.PAN, name: 'Orphan' });

      expect(res.status).toBe(404);
    });

    it('creates a root folder (parentFolderId null)', async () => {
      const res = await request(app)
        .post(`/api/v1/documents/businesses/${fx.businessId}/folders`)
        .set('Authorization', `Bearer ${fullToken()}`)
        .send({ category: DocumentCategory.PAN, name: 'Registration Docs' });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        businessId: fx.businessId,
        category: DocumentCategory.PAN,
        parentFolderId: null,
        name: 'Registration Docs',
      });
    });

    it('creates a sub-folder under an existing folder', async () => {
      const parent = await request(app)
        .post(`/api/v1/documents/businesses/${fx.businessId}/folders`)
        .set('Authorization', `Bearer ${fullToken()}`)
        .send({ category: DocumentCategory.GST, name: 'GST Certificates' });
      expect(parent.status).toBe(201);

      const child = await request(app)
        .post(`/api/v1/documents/businesses/${fx.businessId}/folders`)
        .set('Authorization', `Bearer ${fullToken()}`)
        .send({ category: DocumentCategory.GST, parentFolderId: parent.body.data.id, name: 'FY 2025-26' });

      expect(child.status).toBe(201);
      expect(child.body.data.parentFolderId).toBe(parent.body.data.id);
    });

    it('rejects a parent folder that belongs to a different category (400)', async () => {
      const panParent = await request(app)
        .post(`/api/v1/documents/businesses/${fx.businessId}/folders`)
        .set('Authorization', `Bearer ${fullToken()}`)
        .send({ category: DocumentCategory.PAN, name: 'PAN Parent' });
      expect(panParent.status).toBe(201);

      const res = await request(app)
        .post(`/api/v1/documents/businesses/${fx.businessId}/folders`)
        .set('Authorization', `Bearer ${fullToken()}`)
        .send({ category: DocumentCategory.GST, parentFolderId: panParent.body.data.id, name: 'Mismatched Category Child' });

      expect(res.status).toBe(400);
    });

    it('rejects a parent folder that belongs to a different Business (400)', async () => {
      const otherBusinessParent = await request(app)
        .post(`/api/v1/documents/businesses/${fx.otherBusinessId}/folders`)
        .set('Authorization', `Bearer ${fullToken()}`)
        .send({ category: DocumentCategory.ROC, name: 'Other Business Folder' });
      expect(otherBusinessParent.status).toBe(201);

      const res = await request(app)
        .post(`/api/v1/documents/businesses/${fx.businessId}/folders`)
        .set('Authorization', `Bearer ${fullToken()}`)
        .send({ category: DocumentCategory.ROC, parentFolderId: otherBusinessParent.body.data.id, name: 'Cross-Business Child' });

      expect(res.status).toBe(400);
    });

    it('rejects a duplicate sibling name at the same level (409)', async () => {
      const category = DocumentCategory.BANK;
      const first = await request(app)
        .post(`/api/v1/documents/businesses/${fx.businessId}/folders`)
        .set('Authorization', `Bearer ${fullToken()}`)
        .send({ category, name: 'Statements' });
      expect(first.status).toBe(201);

      const duplicate = await request(app)
        .post(`/api/v1/documents/businesses/${fx.businessId}/folders`)
        .set('Authorization', `Bearer ${fullToken()}`)
        .send({ category, name: 'Statements' });

      expect(duplicate.status).toBe(409);
    });

    it('lists every folder for a Business, optionally narrowed to one category', async () => {
      const category = DocumentCategory.AGREEMENTS;
      await request(app)
        .post(`/api/v1/documents/businesses/${fx.businessId}/folders`)
        .set('Authorization', `Bearer ${fullToken()}`)
        .send({ category, name: 'Vendor Agreements' });

      const res = await request(app)
        .get(`/api/v1/documents/businesses/${fx.businessId}/folders`)
        .query({ category })
        .set('Authorization', `Bearer ${fullToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((f: { category: string }) => f.category === category)).toBe(true);
    });

    it('renames a folder', async () => {
      const created = await request(app)
        .post(`/api/v1/documents/businesses/${fx.businessId}/folders`)
        .set('Authorization', `Bearer ${fullToken()}`)
        .send({ category: DocumentCategory.PAYROLL, name: 'Old Name' });

      const renamed = await request(app)
        .patch(`/api/v1/documents/folders/${created.body.data.id}`)
        .set('Authorization', `Bearer ${fullToken()}`)
        .send({ name: 'New Name' });

      expect(renamed.status).toBe(200);
      expect(renamed.body.data.name).toBe('New Name');
    });

    it('cannot delete a folder that still has a sub-folder (409)', async () => {
      const parent = await request(app)
        .post(`/api/v1/documents/businesses/${fx.businessId}/folders`)
        .set('Authorization', `Bearer ${fullToken()}`)
        .send({ category: DocumentCategory.DSC, name: 'DSC Parent' });
      await request(app)
        .post(`/api/v1/documents/businesses/${fx.businessId}/folders`)
        .set('Authorization', `Bearer ${fullToken()}`)
        .send({ category: DocumentCategory.DSC, parentFolderId: parent.body.data.id, name: 'DSC Child' });

      const res = await request(app)
        .delete(`/api/v1/documents/folders/${parent.body.data.id}`)
        .set('Authorization', `Bearer ${fullToken()}`);

      expect(res.status).toBe(409);
    });

    it('cannot delete a folder that still has a document (409)', async () => {
      const folder = await request(app)
        .post(`/api/v1/documents/businesses/${fx.businessId}/folders`)
        .set('Authorization', `Bearer ${fullToken()}`)
        .send({ category: DocumentCategory.IDENTITY, name: 'Identity Docs' });

      await prisma.document.create({
        data: {
          tenantId: fx.tenantId,
          businessId: fx.businessId,
          folderId: folder.body.data.id,
          category: DocumentCategory.IDENTITY,
          fileName: 'id-card.pdf',
          storageKey: `${fx.tenantId}/${randomUUID()}-id-card.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: 12345,
          uploadedById: fx.userId,
        },
      });

      const res = await request(app)
        .delete(`/api/v1/documents/folders/${folder.body.data.id}`)
        .set('Authorization', `Bearer ${fullToken()}`);

      expect(res.status).toBe(409);
    });

    it('deletes an empty folder', async () => {
      const created = await request(app)
        .post(`/api/v1/documents/businesses/${fx.businessId}/folders`)
        .set('Authorization', `Bearer ${fullToken()}`)
        .send({ category: DocumentCategory.OTHER, name: 'Deletable' });

      const res = await request(app)
        .delete(`/api/v1/documents/folders/${created.body.data.id}`)
        .set('Authorization', `Bearer ${fullToken()}`);
      expect(res.status).toBe(200);

      const getAfterDelete = await request(app)
        .get(`/api/v1/documents/folders/${created.body.data.id}`)
        .set('Authorization', `Bearer ${fullToken()}`);
      expect(getAfterDelete.status).toBe(404);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Search by folder (PRD §7.1 rule 6) — Document rows seeded directly via
  // Prisma, exactly like `prisma/seeds/dev-data.seed.ts` (no real S3 upload
  // in this environment — see this file's header comment).
  // ────────────────────────────────────────────────────────────────────────
  describe('search by folder', () => {
    it('GET /documents?folderId= only returns documents inside that folder', async () => {
      const folderA = await request(app)
        .post(`/api/v1/documents/businesses/${fx.businessId}/folders`)
        .set('Authorization', `Bearer ${fullToken()}`)
        .send({ category: DocumentCategory.AUDIT, name: 'Audit Folder A' });
      const folderB = await request(app)
        .post(`/api/v1/documents/businesses/${fx.businessId}/folders`)
        .set('Authorization', `Bearer ${fullToken()}`)
        .send({ category: DocumentCategory.AUDIT, name: 'Audit Folder B' });

      const [docInA, docInB] = await Promise.all([
        prisma.document.create({
          data: {
            tenantId: fx.tenantId,
            businessId: fx.businessId,
            folderId: folderA.body.data.id,
            category: DocumentCategory.AUDIT,
            fileName: 'in-folder-a.pdf',
            storageKey: `${fx.tenantId}/${randomUUID()}-a.pdf`,
            mimeType: 'application/pdf',
            sizeBytes: 111,
            uploadedById: fx.userId,
          },
        }),
        prisma.document.create({
          data: {
            tenantId: fx.tenantId,
            businessId: fx.businessId,
            folderId: folderB.body.data.id,
            category: DocumentCategory.AUDIT,
            fileName: 'in-folder-b.pdf',
            storageKey: `${fx.tenantId}/${randomUUID()}-b.pdf`,
            mimeType: 'application/pdf',
            sizeBytes: 222,
            uploadedById: fx.userId,
          },
        }),
      ]);

      const res = await request(app)
        .get('/api/v1/documents')
        .query({ folderId: folderA.body.data.id })
        .set('Authorization', `Bearer ${fullToken()}`);

      expect(res.status).toBe(200);
      const ids: string[] = res.body.data.map((d: { id: string }) => d.id);
      expect(ids).toContain(docInA.id);
      expect(ids).not.toContain(docInB.id);
    });
  });
});
