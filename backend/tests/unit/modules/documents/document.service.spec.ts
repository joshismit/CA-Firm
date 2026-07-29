import { Request } from 'express';
import { Document, DocumentCategory } from '@prisma/client';

/**
 * See the identical comment in tests/unit/modules/business/business.service.spec.ts
 * for why @config/database is stubbed — DocumentRepository/S3StorageService
 * are both injected as mocks via the constructor below, so the real
 * singleton is never touched, but importing anything under `@modules/*`
 * still transitively imports it.
 */
jest.mock('@config/database', () => ({ prisma: {} }));

import { UserRole } from '@shared/enums';
import { UPLOAD } from '@shared/constants';
import { BadRequestError, NotFoundError, UnauthorizedError } from '@shared/errors';
import { DocumentService } from '@modules/documents/service/document.service';
import { DocumentRepository } from '@modules/documents/repository/document.repository';
import { S3StorageService } from '@storage/s3-storage.service';
import { CreateDocumentDto, UpdateDocumentDto, ListDocumentsQueryDto } from '@modules/documents/dto/document.req.dto';

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

type MockedDocumentRepository = {
  [K in 'findById' | 'create' | 'update' | 'delete' | 'search']: jest.Mock;
};
type MockedStorageService = { [K in 'upload' | 'getDownloadUrl']: jest.Mock };

function createMockDocumentRepository(): MockedDocumentRepository {
  return { findById: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), search: jest.fn() };
}
function createMockStorageService(): MockedStorageService {
  return { upload: jest.fn(), getDownloadUrl: jest.fn() };
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
    contactId: null,
    category: DocumentCategory.PAN,
    fileName: 'pan-card.pdf',
    storageKey: `${TENANT_ID}/abc123-pan-card.pdf`,
    mimeType: 'application/pdf',
    sizeBytes: 204800,
    version: 1,
    uploadedById: USER_ID,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  };
}

function createMockFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'pan-card.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    buffer: Buffer.from('fake-file-contents'),
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
}

function createMocks(): ServiceMocks {
  return { documentRepository: createMockDocumentRepository(), storageService: createMockStorageService() };
}

function createService(mocks: ServiceMocks, req: Request = createFakeRequest()): DocumentService {
  return new DocumentService(
    req,
    mocks.documentRepository as unknown as DocumentRepository,
    mocks.storageService as unknown as S3StorageService,
  );
}

describe('DocumentService', () => {
  // ────────────────────────────────────────────────────────────────────────
  // uploadDocument
  // ────────────────────────────────────────────────────────────────────────
  describe('uploadDocument', () => {
    const dto: CreateDocumentDto = { category: DocumentCategory.PAN };

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

    it('throws BadRequestError for an unsupported mime type', async () => {
      const mocks = createMocks();
      const service = createService(mocks);
      const file = createMockFile({ mimetype: 'application/x-executable' });

      await expect(service.uploadDocument(dto, file)).rejects.toThrow(BadRequestError);
      expect(mocks.storageService.upload).not.toHaveBeenCalled();
    });

    it('throws BadRequestError when the file exceeds the maximum upload size', async () => {
      const mocks = createMocks();
      const service = createService(mocks);
      const file = createMockFile({ size: UPLOAD.MAX_FILE_SIZE_BYTES + 1 });

      await expect(service.uploadDocument(dto, file)).rejects.toThrow(BadRequestError);
      expect(mocks.storageService.upload).not.toHaveBeenCalled();
    });

    it('accepts a file exactly at the maximum upload size', async () => {
      const mocks = createMocks();
      mocks.documentRepository.create.mockResolvedValue(createMockDocument());
      const service = createService(mocks);
      const file = createMockFile({ size: UPLOAD.MAX_FILE_SIZE_BYTES });

      await expect(service.uploadDocument(dto, file)).resolves.toBeDefined();
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
          contactId: null,
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

      expect(mocks.documentRepository.update).toHaveBeenCalledWith('doc-1', dto, { tenantId: TENANT_ID });
      expect(result).toBe(updated);
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

      expect(mocks.storageService.getDownloadUrl).toHaveBeenCalledWith(document.storageKey);
      expect(result.url).toBe('https://bucket.example.test/signed-url');
      expect(typeof result.expiresInSeconds).toBe('number');
    });
  });
});
