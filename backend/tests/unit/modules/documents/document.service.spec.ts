import { Request } from 'express';
import { Document, DocumentCategory, DocumentApprovalStatus } from '@prisma/client';

/**
 * See the identical comment in tests/unit/modules/business/business.service.spec.ts
 * for why @config/database is stubbed — DocumentRepository/S3StorageService
 * are both injected as mocks via the constructor below, so the real
 * singleton is never touched, but importing anything under `@modules/*`
 * still transitively imports it. `$transaction` needs a working stub too —
 * `DocumentService.createVersion()`/the conflict-confirm path in
 * `uploadDocument()` both wrap their writes in a real `this.transaction()`
 * call, exactly like `LeadService.convertLead()` (see that spec's identical
 * comment).
 */
jest.mock('@config/database', () => ({
  prisma: { $transaction: jest.fn((operation: (tx: unknown) => unknown) => operation({})) },
}));

import { AuditEventType } from '@prisma/client';
import { UserRole } from '@shared/enums';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, UnsupportedMediaTypeError } from '@shared/errors';
import { DocumentService } from '@modules/documents/service/document.service';
import { DocumentRepository } from '@modules/documents/repository/document.repository';
import { DocumentShareRepository } from '@modules/documents/repository/document-share.repository';
import { DocumentFolderRepository } from '@modules/documents/repository/document-folder.repository';
import { StorageQuotaService } from '@modules/documents/service/storage-quota.service';
import { DocumentAccessScope, DocumentAccessScopeService } from '@modules/documents/service/document-access-scope.service';
import { UserRepository } from '@modules/users/repository/user.repository';
import { AuditLogRecorder } from '@modules/audit';
import { S3StorageService } from '@storage/s3-storage.service';
import {
  CreateDocumentDto,
  UpdateDocumentDto,
  ListDocumentsQueryDto,
  ShareDocumentDto,
} from '@modules/documents/dto/document.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DocumentService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `DocumentRepository` and `S3StorageService` are fully mocked — these tests
 * exercise only the business logic in `DocumentService` (file validation,
 * storage-key construction, existence guards, DTO → repository mapping),
 * never a real database or a real S3/R2 bucket. Mocks are injected via the
 * service's constructor DI parameters, exactly as designed for this. Mirrors
 * `tests/unit/modules/crm/lead.service.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';
const BUSINESS_ID = 'business-66666666-6666-6666-6666-666666666666';
const CONTACT_ID = 'contact-77777777-7777-7777-7777-777777777777';
const OTHER_USER_ID = 'user-88888888-8888-8888-8888-888888888888';

type MockedDocumentRepository = {
  [K in 'findById' | 'create' | 'update' | 'delete' | 'search' | 'findConflict' | 'findVersionChain']: jest.Mock;
};
type MockedStorageService = { [K in 'upload' | 'getDownloadUrl']: jest.Mock };
type MockedAccessScopeService = { resolve: jest.Mock };
type MockedDocumentShareRepository = { upsertShare: jest.Mock };
type MockedUserRepository = { exists: jest.Mock };
type MockedFolderRepository = { findById: jest.Mock };
type MockedStorageQuotaService = {
  [K in 'assertFileSizeAllowed' | 'assertBusinessQuota' | 'assertTenantQuota' | 'getEffectiveMaxUploadBytes' | 'getBusinessStorageSummary' | 'getTenantStorageSummary']: jest.Mock;
};
type MockedAuditLogRecorder = { record: jest.Mock };

function createMockDocumentRepository(): MockedDocumentRepository {
  return {
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    search: jest.fn(),
    // Defaults to "no conflict" so every existing uploadDocument test (none of which cares about
    // versioning) keeps hitting the plain create path unchanged.
    findConflict: jest.fn().mockResolvedValue(null),
    findVersionChain: jest.fn(),
  };
}
function createMockStorageService(): MockedStorageService {
  return { upload: jest.fn(), getDownloadUrl: jest.fn() };
}
/** Defaults to an unrestricted scope (mirrors what a real TENANT_ADMIN caller resolves to). */
function createMockAccessScopeService(scope: DocumentAccessScope = {}): MockedAccessScopeService {
  return { resolve: jest.fn().mockResolvedValue(scope) };
}
function createMockDocumentShareRepository(): MockedDocumentShareRepository {
  return { upsertShare: jest.fn() };
}
function createMockUserRepository(): MockedUserRepository {
  return { exists: jest.fn().mockResolvedValue(true) };
}
function createMockFolderRepository(): MockedFolderRepository {
  return { findById: jest.fn() };
}
/** Defaults to fully permissive — every `assert*` resolves (no-op), matching "unlimited/no quota
 *  configured" so every pre-existing test (none of which cares about PRD §7.4 quota rules) keeps
 *  hitting the plain success path unchanged. Quota-specific tests override individual mocks. */
function createMockStorageQuotaService(): MockedStorageQuotaService {
  return {
    assertFileSizeAllowed: jest.fn().mockResolvedValue(undefined),
    assertBusinessQuota: jest.fn().mockResolvedValue(undefined),
    assertTenantQuota: jest.fn().mockResolvedValue(undefined),
    getEffectiveMaxUploadBytes: jest.fn().mockResolvedValue(100 * 1024 * 1024),
    getBusinessStorageSummary: jest.fn(),
    getTenantStorageSummary: jest.fn(),
  };
}
function createMockAuditLogRecorder(): MockedAuditLogRecorder {
  return { record: jest.fn().mockResolvedValue(undefined) };
}

function createFakeRequest(): Request {
  return {
    tenant: { id: TENANT_ID, slug: 'acme', name: 'Acme & Co', planCode: 'professional', isActive: true },
    user: { id: USER_ID, email: 'manager@acme.test', role: UserRole.TENANT_ADMIN, tenantId: TENANT_ID, permissions: [] },
    correlationId: 'test-correlation-id',
  } as unknown as Request;
}

function createFakeRequestNoUser(): Request {
  return {
    tenant: { id: TENANT_ID, slug: 'acme', name: 'Acme & Co', planCode: 'professional', isActive: true },
    user: undefined,
    correlationId: 'test-correlation-id',
  } as unknown as Request;
}

function createMockDocument(overrides: Partial<Document> = {}): Document {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'doc-33333333-3333-3333-3333-333333333333',
    tenantId: TENANT_ID,
    businessId: null,
    // Non-null by default so an unmodified `createMockDocument()` already satisfies the "at least
    // one of businessId/contactId" orphan guard `updateDocument()` re-checks on every call.
    contactId: CONTACT_ID,
    folderId: null,
    category: DocumentCategory.PAN,
    fileName: 'pan-card.pdf',
    storageKey: `${TENANT_ID}/abc123-pan-card.pdf`,
    mimeType: 'application/pdf',
    sizeBytes: 204800,
    version: 1,
    isLatestVersion: true,
    rootDocumentId: null,
    previousVersionId: null,
    uploadedById: USER_ID,
    archived: false,
    retentionUntil: null,
    approvalStatus: DocumentApprovalStatus.NOT_REQUIRED,
    reviewerId: null,
    reviewedAt: null,
    reviewComment: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  };
}

/**
 * Real `%PDF` magic bytes followed by filler content — `DocumentService.validateFile()` (PRD
 * §7.5) now cross-checks the buffer's leading bytes against the declared extension/MIME type, so
 * every "happy path" test needs a buffer that actually looks like the file type it claims to be,
 * not an arbitrary string. Tests exercising the file-type rejection path override this directly.
 */
const PDF_MAGIC_BYTES = Buffer.from('25504446', 'hex');

function createMockFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'pan-card.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    buffer: Buffer.concat([PDF_MAGIC_BYTES, Buffer.from('-fake-file-contents')]),
    size: 204800,
    stream: undefined as never,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  } as Express.Multer.File;
}

interface ServiceMocks {
  documentRepository: MockedDocumentRepository;
  storageService: MockedStorageService;
  accessScopeService: MockedAccessScopeService;
  documentShareRepository: MockedDocumentShareRepository;
  userRepository: MockedUserRepository;
  folderRepository: MockedFolderRepository;
  storageQuotaService: MockedStorageQuotaService;
  auditLogRecorder: MockedAuditLogRecorder;
}

function createMocks(scope: DocumentAccessScope = {}): ServiceMocks {
  return {
    documentRepository: createMockDocumentRepository(),
    storageService: createMockStorageService(),
    accessScopeService: createMockAccessScopeService(scope),
    documentShareRepository: createMockDocumentShareRepository(),
    userRepository: createMockUserRepository(),
    folderRepository: createMockFolderRepository(),
    storageQuotaService: createMockStorageQuotaService(),
    auditLogRecorder: createMockAuditLogRecorder(),
  };
}

function createService(mocks: ServiceMocks, req: Request = createFakeRequest()): DocumentService {
  return new DocumentService(
    req,
    mocks.documentRepository as unknown as DocumentRepository,
    mocks.storageService as unknown as S3StorageService,
    mocks.auditLogRecorder as unknown as AuditLogRecorder,
    mocks.accessScopeService as unknown as DocumentAccessScopeService,
    mocks.documentShareRepository as unknown as DocumentShareRepository,
    mocks.userRepository as unknown as UserRepository,
    mocks.folderRepository as unknown as DocumentFolderRepository,
    mocks.storageQuotaService as unknown as StorageQuotaService,
  );
}

describe('DocumentService', () => {
  // ────────────────────────────────────────────────────────────────────────
  // uploadDocument
  // ────────────────────────────────────────────────────────────────────────
  describe('uploadDocument', () => {
    // `contactId` (rather than `businessId`) keeps this the minimal payload that still satisfies
    // the "at least one of businessId/contactId" orphan guard — see the `orphan guard` describe
    // block below for dedicated coverage of that rule itself.
    const dto: CreateDocumentDto = { category: DocumentCategory.PAN, contactId: CONTACT_ID };

    it('throws UnauthorizedError when the request has no authenticated user', async () => {
      const mocks = createMocks();
      const service = createService(mocks, createFakeRequestNoUser());

      await expect(service.uploadDocument(dto, createMockFile())).rejects.toThrow(UnauthorizedError);
      expect(mocks.storageService.upload).not.toHaveBeenCalled();
    });

    it('throws BadRequestError when no file is provided', async () => {
      const mocks = createMocks();
      const service = createService(mocks);

      await expect(service.uploadDocument(dto, undefined)).rejects.toThrow(BadRequestError);
      expect(mocks.storageService.upload).not.toHaveBeenCalled();
    });

    it('throws UnsupportedMediaTypeError for an unsupported mime type', async () => {
      const mocks = createMocks();
      const service = createService(mocks);
      const file = createMockFile({ mimetype: 'application/x-executable' });

      await expect(service.uploadDocument(dto, file)).rejects.toThrow(UnsupportedMediaTypeError);
      expect(mocks.storageService.upload).not.toHaveBeenCalled();
    });

    // PRD §7.4 — the exact size limit is now tenant/plan-resolved by `StorageQuotaService`
    // (unit-tested separately in `storage-quota.service.spec.ts`); `DocumentService` only needs
    // to delegate to it and propagate a rejection. See the "quota enforcement (PRD §7.4)" describe
    // block below for the full size/business/tenant ordering and audit-on-reject coverage.
    it('throws BadRequestError when StorageQuotaService rejects the file size', async () => {
      const mocks = createMocks();
      mocks.storageQuotaService.assertFileSizeAllowed.mockRejectedValue(new BadRequestError('File exceeds the maximum allowed limit'));
      const service = createService(mocks);

      await expect(service.uploadDocument(dto, createMockFile())).rejects.toThrow(BadRequestError);
      expect(mocks.storageService.upload).not.toHaveBeenCalled();
    });

    it('uploads when StorageQuotaService allows the file size', async () => {
      const mocks = createMocks();
      mocks.documentRepository.create.mockResolvedValue(createMockDocument());
      const service = createService(mocks);
      const file = createMockFile({ size: 5 * 1024 * 1024 });

      await expect(service.uploadDocument(dto, file)).resolves.toBeDefined();
      expect(mocks.storageQuotaService.assertFileSizeAllowed).toHaveBeenCalledWith(TENANT_ID, file.size);
    });

    it('uploads the buffer to storage under a tenant-prefixed key, then creates the metadata row', async () => {
      const mocks = createMocks();
      const created = createMockDocument();
      mocks.documentRepository.create.mockResolvedValue(created);
      const service = createService(mocks);
      const file = createMockFile();

      const result = await service.uploadDocument(dto, file);

      expect(mocks.storageService.upload).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^${TENANT_ID}/.+-pan-card\\.pdf$`)),
        file.buffer,
        file.mimetype,
      );
      expect(mocks.documentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: null,
          contactId: CONTACT_ID,
          category: DocumentCategory.PAN,
          fileName: 'pan-card.pdf',
          mimeType: 'application/pdf',
          sizeBytes: file.size,
          version: 1,
          uploadedById: USER_ID,
        }),
        { tenantId: TENANT_ID },
      );
      expect(result).toBe(created);
    });

    it('passes through businessId/contactId instead of defaulting them when provided', async () => {
      const mocks = createMocks();
      mocks.documentRepository.create.mockResolvedValue(createMockDocument());
      const service = createService(mocks);
      const fullDto: CreateDocumentDto = { businessId: BUSINESS_ID, contactId: CONTACT_ID, category: DocumentCategory.GST };

      await service.uploadDocument(fullDto, createMockFile());

      expect(mocks.documentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ businessId: BUSINESS_ID, contactId: CONTACT_ID, category: DocumentCategory.GST }),
        { tenantId: TENANT_ID },
      );
    });

    it('strips path separators, spaces, and other unsafe characters out of the original filename before building the storage key', async () => {
      const mocks = createMocks();
      mocks.documentRepository.create.mockResolvedValue(createMockDocument());
      const service = createService(mocks);
      const file = createMockFile({ originalname: '../../etc/passwd some file?.pdf' });

      await service.uploadDocument(dto, file);

      const storageKey = mocks.storageService.upload.mock.calls[0][0] as string;
      // Only the tenantId prefix is allowed a literal `/` (the S3 "folder" separator);
      // nothing from the sanitized filename component may reintroduce one.
      const fileNameComponent = storageKey.slice(storageKey.indexOf('/') + 1);
      expect(fileNameComponent).not.toMatch(/[/?\s]/);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // file-type validation (PRD §7.5 — Supported File Types). `validateFile()` runs before
  // `assertUploadAllowed()`/the conflict check/S3 write, so every case here must never touch
  // storage. Covers both `uploadDocument()` and `createVersion()` — both call the same
  // `validateFile()`. Allowed cases exercise every PRD §7.5 extension via `SUPPORTED_DOCUMENT_TYPES`
  // fixtures below; rejected cases cover the extension blacklist, extension/MIME mismatch, MIME
  // whitelist, and magic-byte content mismatch (a renamed executable).
  // ────────────────────────────────────────────────────────────────────────
  describe('file-type validation (PRD §7.5)', () => {
    const dto: CreateDocumentDto = { category: DocumentCategory.PAN, contactId: CONTACT_ID };

    const EXE_MAGIC_BYTES = Buffer.from('4D5A', 'hex'); // "MZ" — real Windows PE executable header
    const ZIP_MAGIC_BYTES = Buffer.from('504B0304', 'hex');
    const JPEG_MAGIC_BYTES = Buffer.from('FFD8FF', 'hex');
    const PNG_MAGIC_BYTES = Buffer.from('89504E47', 'hex');
    const OLE2_MAGIC_BYTES = Buffer.from('D0CF11E0A1B11AE1', 'hex');

    // ── Allowed types (PRD §7.5 requirement 11) ──────────────────────────
    const allowedCases: Array<{ label: string; fileName: string; mimetype: string; buffer: Buffer }> = [
      { label: 'pdf', fileName: 'report.pdf', mimetype: 'application/pdf', buffer: PDF_MAGIC_BYTES },
      {
        label: 'xlsx',
        fileName: 'ledger.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: ZIP_MAGIC_BYTES,
      },
      {
        label: 'xls',
        fileName: 'ledger.xls',
        mimetype: 'application/vnd.ms-excel',
        buffer: OLE2_MAGIC_BYTES,
      },
      {
        label: 'docx',
        fileName: 'agreement.docx',
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: ZIP_MAGIC_BYTES,
      },
      { label: 'doc', fileName: 'agreement.doc', mimetype: 'application/msword', buffer: OLE2_MAGIC_BYTES },
      { label: 'jpg', fileName: 'photo.jpg', mimetype: 'image/jpeg', buffer: JPEG_MAGIC_BYTES },
      { label: 'jpeg', fileName: 'image.jpeg', mimetype: 'image/jpeg', buffer: JPEG_MAGIC_BYTES },
      { label: 'png', fileName: 'scan.png', mimetype: 'image/png', buffer: PNG_MAGIC_BYTES },
      { label: 'zip', fileName: 'bundle.zip', mimetype: 'application/zip', buffer: ZIP_MAGIC_BYTES },
    ];

    it.each(allowedCases)('accepts a supported $label file (correct extension, MIME, and content)', async ({ fileName, mimetype, buffer }) => {
      const mocks = createMocks();
      mocks.documentRepository.create.mockResolvedValue(createMockDocument({ fileName }));
      const service = createService(mocks);
      const file = createMockFile({ originalname: fileName, mimetype, buffer: Buffer.concat([buffer, Buffer.from('-rest-of-file')]) });

      await expect(service.uploadDocument(dto, file)).resolves.toBeDefined();
      expect(mocks.storageService.upload).toHaveBeenCalled();
    });

    // ── Rejected — blocked executable/script extensions (PRD §7.5 requirement 4) ────────────
    const blockedExtensions = ['exe', 'dll', 'bat', 'cmd', 'sh', 'js', 'ts', 'php', 'py', 'jar', 'apk', 'ipa'];

    it.each(blockedExtensions)('rejects a .%s file outright, regardless of declared MIME type', async (extension) => {
      const mocks = createMocks();
      const service = createService(mocks);
      const file = createMockFile({ originalname: `payload.${extension}`, mimetype: 'application/octet-stream' });

      await expect(service.uploadDocument(dto, file)).rejects.toThrow(UnsupportedMediaTypeError);
      expect(mocks.storageService.upload).not.toHaveBeenCalled();
    });

    it('rejects an unsupported extension that is not on the whitelist or the blocklist', async () => {
      const mocks = createMocks();
      const service = createService(mocks);
      const file = createMockFile({ originalname: 'notes.txt', mimetype: 'text/plain' });

      await expect(service.uploadDocument(dto, file)).rejects.toThrow(UnsupportedMediaTypeError);
      expect(mocks.storageService.upload).not.toHaveBeenCalled();
    });

    // ── Rejected — extension/MIME mismatch (PRD §7.5 requirements 2-4) ──────────────────────
    it('rejects fake.pdf sent with an executable MIME type', async () => {
      const mocks = createMocks();
      const service = createService(mocks);
      const file = createMockFile({ originalname: 'fake.pdf', mimetype: 'application/x-msdownload' });

      await expect(service.uploadDocument(dto, file)).rejects.toThrow(UnsupportedMediaTypeError);
      expect(mocks.storageService.upload).not.toHaveBeenCalled();
    });

    it('rejects photo.jpg sent as application/octet-stream', async () => {
      const mocks = createMocks();
      const service = createService(mocks);
      const file = createMockFile({ originalname: 'photo.jpg', mimetype: 'application/octet-stream' });

      await expect(service.uploadDocument(dto, file)).rejects.toThrow(UnsupportedMediaTypeError);
      expect(mocks.storageService.upload).not.toHaveBeenCalled();
    });

    // ── Rejected — content doesn't match the declared type, i.e. a renamed executable ───────
    it('rejects a real Windows executable renamed to report.pdf with a spoofed application/pdf MIME type', async () => {
      const mocks = createMocks();
      const service = createService(mocks);
      const file = createMockFile({
        originalname: 'report.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.concat([EXE_MAGIC_BYTES, Buffer.from('-this-is-actually-a-pe-binary')]),
      });

      await expect(service.uploadDocument(dto, file)).rejects.toThrow(UnsupportedMediaTypeError);
      expect(mocks.storageService.upload).not.toHaveBeenCalled();
    });

    // ── Accept — exact PRD §7.5 requirement 11 examples ─────────────────────────────────────
    it('accepts report.pdf with application/pdf', async () => {
      const mocks = createMocks();
      mocks.documentRepository.create.mockResolvedValue(createMockDocument());
      const service = createService(mocks);
      const file = createMockFile({ originalname: 'report.pdf', mimetype: 'application/pdf' });

      await expect(service.uploadDocument(dto, file)).resolves.toBeDefined();
    });

    it('accepts image.jpeg with image/jpeg', async () => {
      const mocks = createMocks();
      mocks.documentRepository.create.mockResolvedValue(createMockDocument());
      const service = createService(mocks);
      const file = createMockFile({
        originalname: 'image.jpeg',
        mimetype: 'image/jpeg',
        buffer: Buffer.concat([JPEG_MAGIC_BYTES, Buffer.from('-rest')]),
      });

      await expect(service.uploadDocument(dto, file)).resolves.toBeDefined();
    });

    // ── Audit logging (requirement 10 — reuse the existing UPLOAD_REJECTED path) ────────────
    it('audit-logs an UPLOAD_REJECTED entry when a file-type rejection fires, without touching storage', async () => {
      const mocks = createMocks();
      const service = createService(mocks);
      const file = createMockFile({ originalname: 'payload.exe', mimetype: 'application/octet-stream' });

      await expect(service.uploadDocument(dto, file)).rejects.toThrow(UnsupportedMediaTypeError);

      expect(mocks.auditLogRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          actorId: USER_ID,
          eventType: AuditEventType.UPLOAD_REJECTED,
        }),
      );
      expect(mocks.storageService.upload).not.toHaveBeenCalled();
    });

    it('createVersion also enforces file-type validation and audit-logs the rejection', async () => {
      const mocks = createMocks();
      const service = createService(mocks);
      const file = createMockFile({ originalname: 'payload.exe', mimetype: 'application/octet-stream' });

      await expect(service.createVersion('doc-1', file)).rejects.toThrow(UnsupportedMediaTypeError);

      expect(mocks.documentRepository.findById).not.toHaveBeenCalled();
      expect(mocks.storageService.upload).not.toHaveBeenCalled();
      expect(mocks.auditLogRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: AuditEventType.UPLOAD_REJECTED, targetType: 'Tenant' }),
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // quota enforcement (PRD §7.4 — Upload Rules): size → business quota →
  // tenant quota, in that order, before the S3 write; rejections are
  // audit-logged (best-effort). `StorageQuotaService` itself is mocked here —
  // its own resolution logic is covered by `storage-quota.service.spec.ts`.
  // ────────────────────────────────────────────────────────────────────────
  describe('quota enforcement (PRD §7.4)', () => {
    const dto: CreateDocumentDto = { category: DocumentCategory.PAN, businessId: BUSINESS_ID };

    it('checks file size before business/tenant quota, and before the conflict check/S3 write', async () => {
      const mocks = createMocks();
      mocks.documentRepository.create.mockResolvedValue(createMockDocument({ businessId: BUSINESS_ID, contactId: null }));
      const service = createService(mocks);
      const file = createMockFile();

      await service.uploadDocument(dto, file);

      expect(mocks.storageQuotaService.assertFileSizeAllowed).toHaveBeenCalledWith(TENANT_ID, file.size);
      expect(mocks.storageQuotaService.assertBusinessQuota).toHaveBeenCalledWith(TENANT_ID, BUSINESS_ID, file.size);
      expect(mocks.storageQuotaService.assertTenantQuota).toHaveBeenCalledWith(TENANT_ID, file.size);
      // findConflict/upload happen only after every quota check has passed.
      expect(mocks.documentRepository.findConflict).toHaveBeenCalled();
      expect(mocks.storageService.upload).toHaveBeenCalled();
    });

    it('throws ForbiddenError and never touches storage when the business quota is exceeded', async () => {
      const mocks = createMocks();
      mocks.storageQuotaService.assertBusinessQuota.mockRejectedValue(new ForbiddenError('Business storage quota exceeded'));
      const service = createService(mocks);

      await expect(service.uploadDocument(dto, createMockFile())).rejects.toThrow(ForbiddenError);
      expect(mocks.storageQuotaService.assertTenantQuota).not.toHaveBeenCalled();
      expect(mocks.documentRepository.findConflict).not.toHaveBeenCalled();
      expect(mocks.storageService.upload).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError and never touches storage when the tenant quota is exceeded', async () => {
      const mocks = createMocks();
      mocks.storageQuotaService.assertTenantQuota.mockRejectedValue(new ForbiddenError('Tenant storage quota exceeded'));
      const service = createService(mocks);

      await expect(service.uploadDocument(dto, createMockFile())).rejects.toThrow(ForbiddenError);
      expect(mocks.storageService.upload).not.toHaveBeenCalled();
    });

    it('skips the business-quota check when the upload has no businessId (contact-only document)', async () => {
      const mocks = createMocks();
      mocks.documentRepository.create.mockResolvedValue(createMockDocument());
      const service = createService(mocks);
      const contactOnlyDto: CreateDocumentDto = { category: DocumentCategory.PAN, contactId: CONTACT_ID };

      await service.uploadDocument(contactOnlyDto, createMockFile());

      expect(mocks.storageQuotaService.assertBusinessQuota).not.toHaveBeenCalled();
      expect(mocks.storageQuotaService.assertTenantQuota).toHaveBeenCalled();
    });

    it('audit-logs an UPLOAD_REJECTED entry when a quota check rejects the upload', async () => {
      const mocks = createMocks();
      const rejection = new ForbiddenError('Business storage quota exceeded');
      mocks.storageQuotaService.assertBusinessQuota.mockRejectedValue(rejection);
      const service = createService(mocks);

      await expect(service.uploadDocument(dto, createMockFile())).rejects.toThrow(ForbiddenError);

      expect(mocks.auditLogRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          actorId: USER_ID,
          eventType: AuditEventType.UPLOAD_REJECTED,
          targetType: 'Business',
          targetId: BUSINESS_ID,
        }),
      );
    });

    it('does not audit-log when the upload succeeds', async () => {
      const mocks = createMocks();
      mocks.documentRepository.create.mockResolvedValue(createMockDocument({ businessId: BUSINESS_ID, contactId: null }));
      const service = createService(mocks);

      await service.uploadDocument(dto, createMockFile());

      expect(mocks.auditLogRecorder.record).not.toHaveBeenCalledWith(
        expect.objectContaining({ eventType: AuditEventType.UPLOAD_REJECTED }),
      );
    });

    it('createVersion (explicit replace endpoint) also enforces quota, scoped to the existing document\'s businessId', async () => {
      const mocks = createMocks();
      const existing = createMockDocument({ id: 'doc-1', businessId: BUSINESS_ID, version: 1 });
      mocks.documentRepository.findById.mockResolvedValue(existing);
      mocks.storageQuotaService.assertTenantQuota.mockRejectedValue(new ForbiddenError('Tenant storage quota exceeded'));
      const service = createService(mocks);

      await expect(service.createVersion('doc-1', createMockFile())).rejects.toThrow(ForbiddenError);
      expect(mocks.storageQuotaService.assertBusinessQuota).toHaveBeenCalledWith(TENANT_ID, BUSINESS_ID, expect.any(Number));
      expect(mocks.storageService.upload).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // updateDocument
  // ────────────────────────────────────────────────────────────────────────
  describe('updateDocument', () => {
    it('throws NotFoundError when the document does not exist', async () => {
      const mocks = createMocks();
      mocks.documentRepository.findById.mockResolvedValue(null);

      const service = createService(mocks);
      const dto: UpdateDocumentDto = { category: DocumentCategory.AUDIT };

      await expect(service.updateDocument('missing-id', dto)).rejects.toThrow(NotFoundError);
      expect(mocks.documentRepository.update).not.toHaveBeenCalled();
    });

    it('updates the document when it exists', async () => {
      const mocks = createMocks();
      mocks.documentRepository.findById.mockResolvedValue(createMockDocument());
      const updated = createMockDocument({ category: DocumentCategory.AUDIT });
      mocks.documentRepository.update.mockResolvedValue(updated);

      const service = createService(mocks);
      const dto: UpdateDocumentDto = { category: DocumentCategory.AUDIT };
      const result = await service.updateDocument('doc-1', dto);

      // The service always re-asserts the effective businessId onto the update payload (see
      // `resolveFolderConsistency()`) — here that's just `existing.businessId` (null) passed through.
      expect(mocks.documentRepository.update).toHaveBeenCalledWith(
        'doc-1',
        { ...dto, businessId: null },
        { tenantId: TENANT_ID },
      );
      expect(result).toBe(updated);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // orphan guard (PRD §7.1 rule 1 — never introduce tenant-level orphan documents)
  // ────────────────────────────────────────────────────────────────────────
  describe('orphan guard', () => {
    it('uploadDocument throws BadRequestError when neither businessId nor contactId is provided', async () => {
      const mocks = createMocks();
      const service = createService(mocks);
      const dto: CreateDocumentDto = { category: DocumentCategory.PAN };

      await expect(service.uploadDocument(dto, createMockFile())).rejects.toThrow(BadRequestError);
      expect(mocks.storageService.upload).not.toHaveBeenCalled();
    });

    it('uploadDocument succeeds with businessId alone', async () => {
      const mocks = createMocks();
      mocks.documentRepository.create.mockResolvedValue(createMockDocument({ businessId: BUSINESS_ID, contactId: null }));
      const service = createService(mocks);
      const dto: CreateDocumentDto = { category: DocumentCategory.PAN, businessId: BUSINESS_ID };

      await expect(service.uploadDocument(dto, createMockFile())).resolves.toBeDefined();
    });

    it('updateDocument throws BadRequestError when clearing both businessId and contactId', async () => {
      const mocks = createMocks();
      mocks.documentRepository.findById.mockResolvedValue(createMockDocument({ businessId: null, contactId: CONTACT_ID }));
      const service = createService(mocks);
      const dto: UpdateDocumentDto = { contactId: null };

      await expect(service.updateDocument('doc-1', dto)).rejects.toThrow(BadRequestError);
      expect(mocks.documentRepository.update).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // folder consistency (PRD §7.1 rule 3 — a folder is rooted at one Business+category)
  // ────────────────────────────────────────────────────────────────────────
  describe('folder consistency', () => {
    const FOLDER_ID = 'folder-44444444-4444-4444-4444-444444444444';

    function createMockFolder(overrides: Partial<{ id: string; businessId: string; category: DocumentCategory }> = {}) {
      return { id: FOLDER_ID, businessId: BUSINESS_ID, category: DocumentCategory.PAN, ...overrides };
    }

    it('uploadDocument throws BadRequestError when the folder does not exist', async () => {
      const mocks = createMocks();
      mocks.folderRepository.findById.mockResolvedValue(null);
      const service = createService(mocks);
      const dto: CreateDocumentDto = { category: DocumentCategory.PAN, folderId: FOLDER_ID };

      await expect(service.uploadDocument(dto, createMockFile())).rejects.toThrow(NotFoundError);
    });

    it('uploadDocument auto-fills businessId from the folder when omitted', async () => {
      const mocks = createMocks();
      mocks.folderRepository.findById.mockResolvedValue(createMockFolder());
      mocks.documentRepository.create.mockResolvedValue(createMockDocument({ businessId: BUSINESS_ID, folderId: FOLDER_ID }));
      const service = createService(mocks);
      const dto: CreateDocumentDto = { category: DocumentCategory.PAN, folderId: FOLDER_ID };

      await service.uploadDocument(dto, createMockFile());

      expect(mocks.documentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ businessId: BUSINESS_ID, folderId: FOLDER_ID }),
        { tenantId: TENANT_ID },
      );
    });

    it('uploadDocument throws BadRequestError when businessId disagrees with the folder', async () => {
      const mocks = createMocks();
      mocks.folderRepository.findById.mockResolvedValue(createMockFolder({ businessId: BUSINESS_ID }));
      const service = createService(mocks);
      const dto: CreateDocumentDto = {
        category: DocumentCategory.PAN,
        folderId: FOLDER_ID,
        businessId: 'business-99999999-9999-9999-9999-999999999999',
      };

      await expect(service.uploadDocument(dto, createMockFile())).rejects.toThrow(BadRequestError);
      expect(mocks.storageService.upload).not.toHaveBeenCalled();
    });

    it('uploadDocument throws BadRequestError when category disagrees with the folder', async () => {
      const mocks = createMocks();
      mocks.folderRepository.findById.mockResolvedValue(createMockFolder({ category: DocumentCategory.GST }));
      const service = createService(mocks);
      const dto: CreateDocumentDto = { category: DocumentCategory.PAN, folderId: FOLDER_ID, businessId: BUSINESS_ID };

      await expect(service.uploadDocument(dto, createMockFile())).rejects.toThrow(BadRequestError);
    });

    it('updateDocument re-validates folder consistency when folderId is set on an existing document', async () => {
      const mocks = createMocks();
      mocks.documentRepository.findById.mockResolvedValue(
        createMockDocument({ businessId: BUSINESS_ID, category: DocumentCategory.PAN }),
      );
      mocks.folderRepository.findById.mockResolvedValue(createMockFolder({ businessId: 'some-other-business' }));
      const service = createService(mocks);
      const dto: UpdateDocumentDto = { folderId: FOLDER_ID };

      await expect(service.updateDocument('doc-1', dto)).rejects.toThrow(BadRequestError);
      expect(mocks.documentRepository.update).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // deleteDocument
  // ────────────────────────────────────────────────────────────────────────
  describe('deleteDocument', () => {
    it('throws NotFoundError when the document does not exist', async () => {
      const mocks = createMocks();
      mocks.documentRepository.findById.mockResolvedValue(null);

      const service = createService(mocks);

      await expect(service.deleteDocument('missing-id')).rejects.toThrow(NotFoundError);
      expect(mocks.documentRepository.delete).not.toHaveBeenCalled();
    });

    it('soft-deletes an existing document, passing userId', async () => {
      const mocks = createMocks();
      mocks.documentRepository.findById.mockResolvedValue(createMockDocument());
      mocks.documentRepository.delete.mockResolvedValue(true);

      const service = createService(mocks);
      await service.deleteDocument('doc-1');

      expect(mocks.documentRepository.delete).toHaveBeenCalledWith('doc-1', { tenantId: TENANT_ID, userId: USER_ID });
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // getDocumentById / listDocuments
  // ────────────────────────────────────────────────────────────────────────
  describe('getDocumentById', () => {
    it('returns the document when found', async () => {
      const mocks = createMocks();
      const document = createMockDocument();
      mocks.documentRepository.findById.mockResolvedValue(document);

      const service = createService(mocks);
      const result = await service.getDocumentById(document.id);

      expect(mocks.documentRepository.findById).toHaveBeenCalledWith(document.id, { tenantId: TENANT_ID });
      expect(result).toBe(document);
    });

    it('throws NotFoundError when no document matches the ID', async () => {
      const mocks = createMocks();
      mocks.documentRepository.findById.mockResolvedValue(null);

      const service = createService(mocks);

      await expect(service.getDocumentById('missing-id')).rejects.toThrow(NotFoundError);
    });
  });

  describe('listDocuments', () => {
    it('delegates to repository.search with the filters and pagination mapped from the query', async () => {
      const mocks = createMocks();
      const documents = [createMockDocument(), createMockDocument({ id: 'doc-2' })];
      const paginated = {
        data: documents,
        meta: { page: 1, limit: 20, total: 2, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      };
      mocks.documentRepository.search.mockResolvedValue(paginated);

      const service = createService(mocks);
      const query: ListDocumentsQueryDto = {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        search: 'pan',
        category: DocumentCategory.PAN,
        businessId: BUSINESS_ID,
      };

      const result = await service.listDocuments(query);

      expect(mocks.documentRepository.search).toHaveBeenCalledWith(
        { category: DocumentCategory.PAN, businessId: BUSINESS_ID, search: 'pan' },
        { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
        { tenantId: TENANT_ID },
        {}, // unrestricted scope (default mock) -> DocumentAccessScopeService.toWhereInput({}) === {}
      );
      expect(result).toBe(paginated);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // getDownloadUrl
  // ────────────────────────────────────────────────────────────────────────
  describe('getDownloadUrl', () => {
    it('throws NotFoundError when the document does not exist', async () => {
      const mocks = createMocks();
      mocks.documentRepository.findById.mockResolvedValue(null);

      const service = createService(mocks);

      await expect(service.getDownloadUrl('missing-id')).rejects.toThrow(NotFoundError);
      expect(mocks.storageService.getDownloadUrl).not.toHaveBeenCalled();
    });

    it('returns a presigned URL built from the document storageKey', async () => {
      const mocks = createMocks();
      const document = createMockDocument();
      mocks.documentRepository.findById.mockResolvedValue(document);
      mocks.storageService.getDownloadUrl.mockResolvedValue('https://bucket.example.test/signed-url');

      const service = createService(mocks);
      const result = await service.getDownloadUrl(document.id);

      expect(mocks.storageService.getDownloadUrl).toHaveBeenCalledWith(document.storageKey, document.fileName);
      expect(result.url).toBe('https://bucket.example.test/signed-url');
      expect(typeof result.expiresInSeconds).toBe('number');
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Access scope enforcement (PRD 6.2) — DocumentAccessScopeService.resolve()
  // itself is unit-tested separately (document-access-scope.service.spec.ts);
  // these tests only confirm DocumentService wires a restrictive scope into
  // every call site.
  // ────────────────────────────────────────────────────────────────────────
  describe('access scope enforcement', () => {
    const OTHER_BUSINESS_ID = 'business-99999999-9999-9999-9999-999999999999';
    const restrictedToOtherBusiness: DocumentAccessScope = { businessIds: [OTHER_BUSINESS_ID] };

    it('getDocumentById throws ForbiddenError when the document is outside the resolved scope', async () => {
      const mocks = createMocks(restrictedToOtherBusiness);
      mocks.documentRepository.findById.mockResolvedValue(createMockDocument({ businessId: BUSINESS_ID }));

      const service = createService(mocks);

      await expect(service.getDocumentById('doc-1')).rejects.toThrow(ForbiddenError);
    });

    it('getDocumentById succeeds when the document is inside the resolved scope', async () => {
      const mocks = createMocks({ businessIds: [BUSINESS_ID] });
      const document = createMockDocument({ businessId: BUSINESS_ID });
      mocks.documentRepository.findById.mockResolvedValue(document);

      const service = createService(mocks);

      await expect(service.getDocumentById(document.id)).resolves.toBe(document);
    });

    it('listDocuments ANDs the scope-derived where clause onto repository.search', async () => {
      const mocks = createMocks({ categories: [DocumentCategory.AUDIT] });
      mocks.documentRepository.search.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false },
      });

      const service = createService(mocks);
      await service.listDocuments({ page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' });

      expect(mocks.documentRepository.search).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        { tenantId: TENANT_ID },
        { AND: [{ category: { in: [DocumentCategory.AUDIT] } }] },
      );
    });

    it('uploadDocument throws ForbiddenError when businessId is outside the resolved scope', async () => {
      const mocks = createMocks(restrictedToOtherBusiness);
      const service = createService(mocks);
      const dto: CreateDocumentDto = { businessId: BUSINESS_ID, category: DocumentCategory.PAN };

      await expect(service.uploadDocument(dto, createMockFile())).rejects.toThrow(ForbiddenError);
      expect(mocks.storageService.upload).not.toHaveBeenCalled();
    });

    it('updateDocument throws ForbiddenError when the existing document is outside the resolved scope', async () => {
      const mocks = createMocks(restrictedToOtherBusiness);
      mocks.documentRepository.findById.mockResolvedValue(createMockDocument({ businessId: BUSINESS_ID }));

      const service = createService(mocks);

      await expect(service.updateDocument('doc-1', { category: DocumentCategory.GST })).rejects.toThrow(ForbiddenError);
      expect(mocks.documentRepository.update).not.toHaveBeenCalled();
    });

    it('updateDocument throws ForbiddenError when reassigning businessId to one outside the resolved scope', async () => {
      const mocks = createMocks({ businessIds: [BUSINESS_ID] });
      mocks.documentRepository.findById.mockResolvedValue(createMockDocument({ businessId: BUSINESS_ID }));

      const service = createService(mocks);
      const dto: UpdateDocumentDto = { businessId: OTHER_BUSINESS_ID };

      await expect(service.updateDocument('doc-1', dto)).rejects.toThrow(ForbiddenError);
      expect(mocks.documentRepository.update).not.toHaveBeenCalled();
    });

    it('deleteDocument throws ForbiddenError when the document is outside the resolved scope', async () => {
      const mocks = createMocks(restrictedToOtherBusiness);
      mocks.documentRepository.findById.mockResolvedValue(createMockDocument({ businessId: BUSINESS_ID }));

      const service = createService(mocks);

      await expect(service.deleteDocument('doc-1')).rejects.toThrow(ForbiddenError);
      expect(mocks.documentRepository.delete).not.toHaveBeenCalled();
    });

    it('an explicit share bypasses an otherwise-restrictive scope', async () => {
      const document = createMockDocument({ businessId: BUSINESS_ID });
      const mocks = createMocks({ businessIds: [OTHER_BUSINESS_ID], sharedDocumentIds: [document.id] });
      mocks.documentRepository.findById.mockResolvedValue(document);

      const service = createService(mocks);

      await expect(service.getDocumentById(document.id)).resolves.toBe(document);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // uploadDocument — replace-candidate detection (PRD §7.2 rules 6-7)
  // ────────────────────────────────────────────────────────────────────────
  describe('uploadDocument — conflict detection', () => {
    const dto: CreateDocumentDto = { category: DocumentCategory.PAN, contactId: CONTACT_ID };

    it('checks for a conflict scoped to Business+Contact+Folder+Category+filename before touching storage', async () => {
      const mocks = createMocks();
      mocks.documentRepository.create.mockResolvedValue(createMockDocument());
      const service = createService(mocks);
      const file = createMockFile({ originalname: 'pan-card.pdf' });

      await service.uploadDocument(dto, file);

      expect(mocks.documentRepository.findConflict).toHaveBeenCalledWith(
        { businessId: null, contactId: CONTACT_ID, folderId: null, category: DocumentCategory.PAN, fileName: 'pan-card.pdf' },
        { tenantId: TENANT_ID },
      );
    });

    it('throws ConflictError (409) without touching storage when a same-name document already exists and createVersion is not set', async () => {
      const mocks = createMocks();
      const existing = createMockDocument({ id: 'existing-doc', version: 1 });
      mocks.documentRepository.findConflict.mockResolvedValue(existing);
      const service = createService(mocks);

      await expect(service.uploadDocument(dto, createMockFile())).rejects.toThrow(ConflictError);
      expect(mocks.storageService.upload).not.toHaveBeenCalled();
      expect(mocks.documentRepository.create).not.toHaveBeenCalled();
    });

    it("the 409's details carry the current version and the next version number (\"replacement candidate detected\")", async () => {
      const mocks = createMocks();
      const existing = createMockDocument({ id: 'existing-doc', version: 3 });
      mocks.documentRepository.findConflict.mockResolvedValue(existing);
      const service = createService(mocks);

      try {
        await service.uploadDocument(dto, createMockFile());
        throw new Error('expected uploadDocument to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictError);
        const details = (err as ConflictError).details as { message: string; nextVersion: number; currentVersion: { id: string } };
        expect(details.message).toBe('Replacement candidate detected');
        expect(details.nextVersion).toBe(4);
        expect(details.currentVersion.id).toBe('existing-doc');
      }
    });

    it('creates a new version instead of a fresh document when a conflict exists and createVersion is true', async () => {
      const mocks = createMocks();
      const existing = createMockDocument({ id: 'existing-doc', version: 1, storageKey: `${TENANT_ID}/old-key.pdf` });
      mocks.documentRepository.findConflict.mockResolvedValue(existing);
      mocks.documentRepository.update.mockResolvedValue({ ...existing, isLatestVersion: false });
      const newVersion = createMockDocument({ id: 'new-doc', version: 2, previousVersionId: 'existing-doc', rootDocumentId: 'existing-doc' });
      mocks.documentRepository.create.mockResolvedValue(newVersion);
      const service = createService(mocks);

      const result = await service.uploadDocument({ ...dto, createVersion: true }, createMockFile());

      expect(mocks.storageService.upload).toHaveBeenCalledTimes(1);
      const storageKey = mocks.storageService.upload.mock.calls[0][0] as string;
      expect(storageKey).not.toBe(existing.storageKey); // never reuses/renames the old object's key
      expect(mocks.documentRepository.update).toHaveBeenCalledWith('existing-doc', { isLatestVersion: false }, { tenantId: TENANT_ID, tx: {} });
      expect(mocks.documentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ version: 2, isLatestVersion: true, previousVersionId: 'existing-doc', rootDocumentId: 'existing-doc' }),
        { tenantId: TENANT_ID, tx: {} },
      );
      expect(result).toBe(newVersion);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // createVersion — POST /documents/:id/version (PRD §7.2 rule 8)
  // ────────────────────────────────────────────────────────────────────────
  describe('createVersion', () => {
    it('throws NotFoundError when the target document does not exist', async () => {
      const mocks = createMocks();
      mocks.documentRepository.findById.mockResolvedValue(null);
      const service = createService(mocks);

      await expect(service.createVersion('missing-id', createMockFile())).rejects.toThrow(NotFoundError);
      expect(mocks.storageService.upload).not.toHaveBeenCalled();
    });

    it('throws BadRequestError when no file is provided', async () => {
      const mocks = createMocks();
      const service = createService(mocks);

      await expect(service.createVersion('doc-1', undefined)).rejects.toThrow(BadRequestError);
    });

    it('throws ForbiddenError when the existing document is outside the resolved scope', async () => {
      const mocks = createMocks({ businessIds: ['some-other-business'] });
      mocks.documentRepository.findById.mockResolvedValue(createMockDocument({ businessId: BUSINESS_ID }));
      const service = createService(mocks);

      await expect(service.createVersion('doc-1', createMockFile())).rejects.toThrow(ForbiddenError);
    });

    it('versions the given document regardless of the new file name (no filename-match required)', async () => {
      const mocks = createMocks();
      const existing = createMockDocument({ id: 'doc-1', version: 1, fileName: 'pan-card.pdf' });
      mocks.documentRepository.findById.mockResolvedValue(existing);
      mocks.documentRepository.update.mockResolvedValue({ ...existing, isLatestVersion: false });
      const newVersion = createMockDocument({ id: 'doc-2', version: 2, fileName: 'pan-card-rescanned.pdf' });
      mocks.documentRepository.create.mockResolvedValue(newVersion);
      const service = createService(mocks);
      const file = createMockFile({ originalname: 'pan-card-rescanned.pdf' });

      const result = await service.createVersion('doc-1', file);

      expect(mocks.documentRepository.update).toHaveBeenCalledWith('doc-1', { isLatestVersion: false }, { tenantId: TENANT_ID, tx: {} });
      expect(mocks.documentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: 'pan-card-rescanned.pdf',
          version: 2,
          isLatestVersion: true,
          previousVersionId: 'doc-1',
          rootDocumentId: 'doc-1',
          businessId: existing.businessId,
          contactId: existing.contactId,
          category: existing.category,
        }),
        { tenantId: TENANT_ID, tx: {} },
      );
      expect(result).toBe(newVersion);
    });

    it('resolves rootDocumentId from the existing row when versioning a v2+ document (chains stay flat, not nested)', async () => {
      const mocks = createMocks();
      const existing = createMockDocument({ id: 'doc-2', version: 2, rootDocumentId: 'doc-1', previousVersionId: 'doc-1' });
      mocks.documentRepository.findById.mockResolvedValue(existing);
      mocks.documentRepository.update.mockResolvedValue({ ...existing, isLatestVersion: false });
      mocks.documentRepository.create.mockResolvedValue(createMockDocument({ id: 'doc-3', version: 3 }));
      const service = createService(mocks);

      await service.createVersion('doc-2', createMockFile());

      expect(mocks.documentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ version: 3, rootDocumentId: 'doc-1', previousVersionId: 'doc-2' }),
        { tenantId: TENANT_ID, tx: {} },
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // getVersionHistory — GET /documents/:id/versions (PRD §7.2 rule 8)
  // ────────────────────────────────────────────────────────────────────────
  describe('getVersionHistory', () => {
    it('throws NotFoundError when the document does not exist', async () => {
      const mocks = createMocks();
      mocks.documentRepository.findById.mockResolvedValue(null);
      const service = createService(mocks);

      await expect(service.getVersionHistory('missing-id')).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when the document is outside the resolved scope', async () => {
      const mocks = createMocks({ businessIds: ['some-other-business'] });
      mocks.documentRepository.findById.mockResolvedValue(createMockDocument({ businessId: BUSINESS_ID }));
      const service = createService(mocks);

      await expect(service.getVersionHistory('doc-1')).rejects.toThrow(ForbiddenError);
    });

    it('returns the full chain from the repository, oldest first', async () => {
      const mocks = createMocks();
      const document = createMockDocument({ id: 'doc-2', rootDocumentId: 'doc-1' });
      mocks.documentRepository.findById.mockResolvedValue(document);
      const chain = [
        createMockDocument({ id: 'doc-1', version: 1, isLatestVersion: false }),
        createMockDocument({ id: 'doc-2', version: 2, isLatestVersion: true, rootDocumentId: 'doc-1' }),
      ];
      mocks.documentRepository.findVersionChain.mockResolvedValue(chain);
      const service = createService(mocks);

      const result = await service.getVersionHistory('doc-2');

      expect(mocks.documentRepository.findVersionChain).toHaveBeenCalledWith(document, { tenantId: TENANT_ID });
      expect(result).toBe(chain);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // shareDocument
  // ────────────────────────────────────────────────────────────────────────
  describe('shareDocument', () => {
    const shareDto: ShareDocumentDto = { userId: OTHER_USER_ID };

    it('throws NotFoundError when the document does not exist', async () => {
      const mocks = createMocks();
      mocks.documentRepository.findById.mockResolvedValue(null);

      const service = createService(mocks);

      await expect(service.shareDocument('missing-id', shareDto)).rejects.toThrow(NotFoundError);
      expect(mocks.documentShareRepository.upsertShare).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError when the caller cannot see the document themselves — reuses getDocumentById, no separate check', async () => {
      const mocks = createMocks({ businessIds: ['some-other-business'] });
      mocks.documentRepository.findById.mockResolvedValue(createMockDocument({ businessId: BUSINESS_ID }));

      const service = createService(mocks);

      await expect(service.shareDocument('doc-1', shareDto)).rejects.toThrow(ForbiddenError);
      expect(mocks.documentShareRepository.upsertShare).not.toHaveBeenCalled();
    });

    it('throws BadRequestError when sharing with yourself', async () => {
      const mocks = createMocks();
      mocks.documentRepository.findById.mockResolvedValue(createMockDocument());

      const service = createService(mocks);

      await expect(service.shareDocument('doc-1', { userId: USER_ID })).rejects.toThrow(BadRequestError);
      expect(mocks.documentShareRepository.upsertShare).not.toHaveBeenCalled();
    });

    it('throws BadRequestError when the target user does not exist in this tenant', async () => {
      const mocks = createMocks();
      mocks.documentRepository.findById.mockResolvedValue(createMockDocument());
      mocks.userRepository.exists.mockResolvedValue(false);

      const service = createService(mocks);

      await expect(service.shareDocument('doc-1', shareDto)).rejects.toThrow(BadRequestError);
      expect(mocks.documentShareRepository.upsertShare).not.toHaveBeenCalled();
    });

    it('grants access via DocumentShareRepository.upsertShare and returns the document', async () => {
      const mocks = createMocks();
      const document = createMockDocument();
      mocks.documentRepository.findById.mockResolvedValue(document);

      const service = createService(mocks);
      const result = await service.shareDocument(document.id, shareDto);

      expect(mocks.documentShareRepository.upsertShare).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        documentId: document.id,
        sharedWithUserId: OTHER_USER_ID,
        grantedById: USER_ID,
        expiresAt: null,
      });
      expect(result).toBe(document);
    });
  });
});
