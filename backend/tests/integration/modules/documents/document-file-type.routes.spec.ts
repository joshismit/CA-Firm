import request from 'supertest';
import { Application } from 'express';
import { AuditEventType } from '@prisma/client';
import { prisma } from '@config/database';
import { createDocumentTestApp } from '../../helpers/document-test-app';
import { signAccessToken } from '../../helpers/jwt';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';
import { DOCUMENT_PERMISSIONS } from '@modules/documents/constants/document.permissions';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Documents API — File-Type Validation Integration (PRD §7.5)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Unlike `document.routes.spec.ts` (permission-middleware only — see that
 * file's header comment for why it never sends real file bytes), these tests
 * exercise the *real* multipart upload lifecycle end-to-end: `authMiddleware`
 * → `tenantMiddleware` → `requirePermission` → the real `multer` `fileFilter`
 * → `validate()` → `DocumentController.upload` → the real `DocumentService`
 * against the real test database. Only `S3StorageService` is mocked (no AWS
 * credentials exist in this environment — see `document.routes.spec.ts`'s
 * header comment) so a real object write is never attempted; every other
 * layer, including the `multer` fileFilter and `DocumentService.validateFile`
 * — the two enforcement points PRD §7.5 requires — runs unmocked.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.mock('@storage/s3-storage.service', () => ({
  S3StorageService: jest.fn().mockImplementation(() => ({
    upload: jest.fn().mockResolvedValue(undefined),
    getDownloadUrl: jest.fn().mockResolvedValue('https://example.test/signed-url'),
  })),
}));

jest.setTimeout(30000);

const PDF_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // "%PDF-1.4"
const ZIP_BYTES = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00]);
const EXE_BYTES = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // real "MZ" PE header

describe('Documents API — file-type validation integration (PRD §7.5)', () => {
  let app: Application;
  let fixtures: TestFixtures;
  let businessId: string;
  let token: string;

  beforeAll(async () => {
    app = createDocumentTestApp();
    fixtures = await seedFixtures(prisma);
    const business = await prisma.business.findFirstOrThrow({ where: { tenantId: fixtures.tenantA.tenantId } });
    businessId = business.id;
    token = signAccessToken({
      userId: fixtures.tenantA.userId,
      tenantId: fixtures.tenantA.tenantId,
      permissions: [DOCUMENT_PERMISSIONS.CREATE, DOCUMENT_PERMISSIONS.READ],
    });
  });

  afterAll(async () => {
    await prisma.document.deleteMany({ where: { tenantId: fixtures.tenantA.tenantId } });
    await prisma.auditLog.deleteMany({ where: { tenantId: fixtures.tenantA.tenantId } });
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  function uploadRequest() {
    return request(app)
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${token}`)
      .field('category', 'PAN')
      .field('businessId', businessId);
  }

  describe('accepted uploads (requirement 11 — allowed types)', () => {
    it.each([
      ['report.pdf', 'application/pdf', PDF_BYTES],
      ['bundle.zip', 'application/zip', ZIP_BYTES],
      ['image.jpeg', 'image/jpeg', JPEG_BYTES],
    ])('returns 201 for a supported %s upload', async (fileName, mimetype, bytes) => {
      const res = await uploadRequest().attach('file', bytes, { filename: fileName, contentType: mimetype });

      expect(res.status).toBe(201);
      expect(res.body.data.fileName).toBe(fileName);
      expect(res.body.data.mimeType).toBe(mimetype);
    });
  });

  describe('rejected uploads — multer fileFilter layer (415, before the body is buffered)', () => {
    it('rejects a .exe extension with 415 and never reaches the controller', async () => {
      const res = await uploadRequest().attach('file', Buffer.from('MZ-fake-binary'), {
        filename: 'virus.exe',
        contentType: 'application/octet-stream',
      });

      expect(res.status).toBe(415);
      expect(res.body.success).toBe(false);
    });

    it('rejects photo.jpg declared as application/octet-stream with 415', async () => {
      const res = await uploadRequest().attach('file', Buffer.from('not-really-a-jpeg'), {
        filename: 'photo.jpg',
        contentType: 'application/octet-stream',
      });

      expect(res.status).toBe(415);
    });

    it('rejects an unsupported extension (.txt) with 415', async () => {
      const res = await uploadRequest().attach('file', Buffer.from('plain text notes'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      });

      expect(res.status).toBe(415);
    });
  });

  describe('rejected uploads — DocumentService content-signature layer (415, real bytes checked)', () => {
    it('rejects a renamed executable that passes the fileFilter (matching extension + MIME) but fails the magic-byte check', async () => {
      const res = await uploadRequest().attach('file', EXE_BYTES, {
        filename: 'report.pdf',
        contentType: 'application/pdf',
      });

      expect(res.status).toBe(415);
      expect(res.body.data).toBeUndefined();
    });
  });

  describe('middleware + service both reject invalid uploads', () => {
    it('a caller without documents:create never reaches the fileFilter — 403, not 415', async () => {
      const noCreateToken = signAccessToken({
        userId: fixtures.tenantA.userId,
        tenantId: fixtures.tenantA.tenantId,
        permissions: [DOCUMENT_PERMISSIONS.READ],
      });

      const res = await request(app)
        .post('/api/v1/documents')
        .set('Authorization', `Bearer ${noCreateToken}`)
        .field('category', 'PAN')
        .field('businessId', businessId)
        .attach('file', Buffer.from('MZ-fake-binary'), { filename: 'virus.exe', contentType: 'application/octet-stream' });

      expect(res.status).toBe(403);
    });
  });

  describe('audit logging (requirement 10 — reuse the existing UPLOAD_REJECTED path)', () => {
    it('records an UPLOAD_REJECTED audit entry when DocumentService rejects a renamed executable', async () => {
      const res = await uploadRequest().attach('file', EXE_BYTES, {
        filename: 'report.pdf',
        contentType: 'application/pdf',
      });
      expect(res.status).toBe(415);

      const entry = await prisma.auditLog.findFirst({
        where: { tenantId: fixtures.tenantA.tenantId, eventType: AuditEventType.UPLOAD_REJECTED, actorId: fixtures.tenantA.userId },
        orderBy: { createdAt: 'desc' },
      });

      expect(entry).not.toBeNull();
      expect(entry?.description).toMatch(/upload rejected/i);
    });
  });
});
