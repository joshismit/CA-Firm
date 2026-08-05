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
 * Documents API — Upload Rules Quota Enforcement (PRD §7.4) — Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the real request lifecycle through `DocumentService`'s quota
 * checks (`assertUploadAllowed()` — file size → business quota → tenant
 * quota), which all run BEFORE the real S3/R2 write. Every scenario here is
 * therefore a *rejection*: no test needs a real S3 bucket, mirroring
 * `document.routes.spec.ts`'s reasoning for why this environment never
 * exercises a full successful upload in integration tests. A tenant/business
 * quota is deliberately set to `0` in the reject-by-quota tests — the
 * simplest way to guarantee any positive file size exceeds it without
 * needing to seed a large pre-existing `Document` row.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

/**
 * Real `%PDF` magic bytes, prepended to every fixture buffer below. `DocumentService.validateFile()`
 * (PRD §7.5) now cross-checks an uploaded file's content against its declared `.pdf` extension/MIME
 * type — a check that runs *before* the size/quota logic these tests exercise, so a buffer that
 * doesn't actually look like a PDF would now be rejected at that earlier stage (415) instead of
 * reaching quota enforcement.
 */
const PDF_MAGIC_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46]);
const pdfBuffer = (body: Buffer): Buffer => Buffer.concat([PDF_MAGIC_BYTES, body]);

describe('Documents API — upload rules quota enforcement (PRD §7.4)', () => {
  let app: Application;
  let fixtures: TestFixtures;
  let typeId: string;
  let businessId: string;

  beforeAll(async () => {
    app = createDocumentTestApp();
    fixtures = await seedFixtures(prisma);

    const type = await prisma.businessType.create({
      data: { code: `TEST-QUOTA-TYPE-${randomUUID().slice(0, 8)}`, name: 'Quota Test Type' },
    });
    typeId = type.id;

    const business = await prisma.business.create({
      data: { tenantId: fixtures.tenantA.tenantId, typeId, name: 'Quota Test Business' },
    });
    businessId = business.id;
  });

  afterAll(async () => {
    await prisma.document.deleteMany({ where: { tenantId: fixtures.tenantA.tenantId } });
    await prisma.business.deleteMany({ where: { typeId } });
    await prisma.businessType.delete({ where: { id: typeId } });
    await prisma.tenant.update({ where: { id: fixtures.tenantA.tenantId }, data: { maxUploadSizeMb: null, maxStorageGb: null } });
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.tenant.update({ where: { id: fixtures.tenantA.tenantId }, data: { maxUploadSizeMb: null, maxStorageGb: null } });
    await prisma.business.update({ where: { id: businessId }, data: { storageQuotaMb: null } });
  });

  function token(): string {
    return signAccessToken({
      userId: fixtures.tenantA.userId,
      tenantId: fixtures.tenantA.tenantId,
      permissions: [DOCUMENT_PERMISSIONS.CREATE],
    });
  }

  describe('file size limit', () => {
    it('returns 400 FILE_TOO_LARGE when the file exceeds the tenant\'s effective max upload size', async () => {
      await prisma.tenant.update({ where: { id: fixtures.tenantA.tenantId }, data: { maxUploadSizeMb: 1 } }); // 1 MB cap

      const res = await request(app)
        .post('/api/v1/documents')
        .set('Authorization', `Bearer ${token()}`)
        .field('category', 'PAN')
        .field('businessId', businessId)
        .attach('file', pdfBuffer(Buffer.alloc(2 * 1024 * 1024, 'x')), 'oversized.pdf');

      expect(res.status).toBe(400);
      expect(res.body.error?.code).toBe('FILE_TOO_LARGE');
    });

    it('a file within the tenant\'s configured limit passes the size check (fails later, at the business quota check, without touching S3)', async () => {
      await prisma.tenant.update({ where: { id: fixtures.tenantA.tenantId }, data: { maxUploadSizeMb: 5 } }); // 5 MB cap
      await prisma.business.update({ where: { id: businessId }, data: { storageQuotaMb: 0 } }); // force the next check to reject

      const res = await request(app)
        .post('/api/v1/documents')
        .set('Authorization', `Bearer ${token()}`)
        .field('category', 'PAN')
        .field('businessId', businessId)
        .attach('file', pdfBuffer(Buffer.alloc(1 * 1024 * 1024, 'x')), 'within-limit.pdf');

      // Not FILE_TOO_LARGE — proves the size check passed and execution reached the next stage.
      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('PLAN_LIMIT_EXCEEDED');
    });
  });

  describe('business quota', () => {
    it('returns 403 PLAN_LIMIT_EXCEEDED when the business has a 0 MB quota', async () => {
      await prisma.business.update({ where: { id: businessId }, data: { storageQuotaMb: 0 } });

      const res = await request(app)
        .post('/api/v1/documents')
        .set('Authorization', `Bearer ${token()}`)
        .field('category', 'PAN')
        .field('businessId', businessId)
        .attach('file', pdfBuffer(Buffer.from('small file contents')), 'small.pdf');

      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('PLAN_LIMIT_EXCEEDED');
    });

    it('writes an UPLOAD_REJECTED audit log entry for the rejected upload', async () => {
      await prisma.business.update({ where: { id: businessId }, data: { storageQuotaMb: 0 } });

      const res = await request(app)
        .post('/api/v1/documents')
        .set('Authorization', `Bearer ${token()}`)
        .field('category', 'GST')
        .field('businessId', businessId)
        .attach('file', pdfBuffer(Buffer.from('small file contents')), 'audit-me.pdf');

      expect(res.status).toBe(403);

      const auditEntry = await prisma.auditLog.findFirst({
        where: { tenantId: fixtures.tenantA.tenantId, eventType: 'UPLOAD_REJECTED', targetType: 'Business', targetId: businessId },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditEntry).not.toBeNull();
    });

    it('skips the business quota check for a contact-only document (no businessId) — only the tenant check can fire', async () => {
      // Business quota is 0 (would reject if checked) but no businessId is sent; tenant quota is
      // also 0, so a rejection still occurs — the audit log's targetType proves WHICH check fired.
      await prisma.business.update({ where: { id: businessId }, data: { storageQuotaMb: 0 } });
      await prisma.tenant.update({ where: { id: fixtures.tenantA.tenantId }, data: { maxStorageGb: 0 } });

      const res = await request(app)
        .post('/api/v1/documents')
        .set('Authorization', `Bearer ${token()}`)
        .field('category', 'PAN')
        .field('contactId', randomUUID())
        .attach('file', pdfBuffer(Buffer.from('small file contents')), 'contact-only.pdf');

      expect(res.status).toBe(403);

      const auditEntry = await prisma.auditLog.findFirst({
        where: { tenantId: fixtures.tenantA.tenantId, eventType: 'UPLOAD_REJECTED', targetType: 'Tenant' },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditEntry).not.toBeNull();
    });
  });

  describe('tenant quota', () => {
    it('returns 403 PLAN_LIMIT_EXCEEDED when the tenant has a 0 GB storage cap', async () => {
      await prisma.tenant.update({ where: { id: fixtures.tenantA.tenantId }, data: { maxStorageGb: 0 } });

      const res = await request(app)
        .post('/api/v1/documents')
        .set('Authorization', `Bearer ${token()}`)
        .field('category', 'PAN')
        .field('businessId', businessId)
        .attach('file', pdfBuffer(Buffer.from('small file contents')), 'small.pdf');

      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('PLAN_LIMIT_EXCEEDED');
    });

    it('never touches business quota once the file-size check already rejected it (checks stop at the first failure)', async () => {
      await prisma.tenant.update({ where: { id: fixtures.tenantA.tenantId }, data: { maxUploadSizeMb: 1, maxStorageGb: 0 } });

      const res = await request(app)
        .post('/api/v1/documents')
        .set('Authorization', `Bearer ${token()}`)
        .field('category', 'PAN')
        .field('businessId', businessId)
        .attach('file', pdfBuffer(Buffer.alloc(2 * 1024 * 1024, 'x')), 'oversized.pdf');

      // The 400 (size) fires before the 403 (tenant quota) would have — proves ordering.
      expect(res.status).toBe(400);
      expect(res.body.error?.code).toBe('FILE_TOO_LARGE');
    });
  });
});
