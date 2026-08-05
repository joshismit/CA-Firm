import { Request } from 'express';
import { DocumentCategory, DocumentFolder } from '@prisma/client';

jest.mock('@config/database', () => ({ prisma: {} }));

import { UserRole } from '@shared/enums';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from '@shared/errors';
import { DocumentFolderService } from '@modules/documents/service/document-folder.service';
import { DocumentFolderRepository } from '@modules/documents/repository/document-folder.repository';
import { BusinessRepository } from '@modules/business/repository/business.repository';
import { DocumentAccessScope, DocumentAccessScopeService } from '@modules/documents/service/document-access-scope.service';
import { CreateFolderDto, UpdateFolderDto } from '@modules/documents/dto/document-folder.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DocumentFolderService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Mirrors `document.service.spec.ts` — repository/access-scope dependencies
 * are fully mocked, exercising only `DocumentFolderService`'s own business
 * logic (Business/parent existence, sibling-name collisions, non-empty
 * delete guard, access-scope enforcement).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';
const BUSINESS_ID = 'business-33333333-3333-3333-3333-333333333333';
const FOLDER_ID = 'folder-44444444-4444-4444-4444-444444444444';
const PARENT_ID = 'folder-55555555-5555-5555-5555-555555555555';

type MockedFolderRepository = {
  [K in 'findById' | 'create' | 'update' | 'delete' | 'findByBusiness' | 'hasChildFolders' | 'hasDocuments']: jest.Mock;
};
type MockedBusinessRepository = { findById: jest.Mock };
type MockedAccessScopeService = { resolve: jest.Mock };

function createMockFolderRepository(): MockedFolderRepository {
  return {
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findByBusiness: jest.fn(),
    hasChildFolders: jest.fn().mockResolvedValue(false),
    hasDocuments: jest.fn().mockResolvedValue(false),
  };
}
function createMockBusinessRepository(exists = true): MockedBusinessRepository {
  return { findById: jest.fn().mockResolvedValue(exists ? { id: BUSINESS_ID } : null) };
}
function createMockAccessScopeService(scope: DocumentAccessScope = {}): MockedAccessScopeService {
  return { resolve: jest.fn().mockResolvedValue(scope) };
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

function createMockFolder(overrides: Partial<DocumentFolder> = {}): DocumentFolder {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: FOLDER_ID,
    tenantId: TENANT_ID,
    businessId: BUSINESS_ID,
    category: DocumentCategory.PAN,
    parentFolderId: null,
    name: 'Registration Docs',
    createdById: USER_ID,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  };
}

interface ServiceMocks {
  folderRepository: MockedFolderRepository;
  businessRepository: MockedBusinessRepository;
  accessScopeService: MockedAccessScopeService;
}

function createMocks(scope: DocumentAccessScope = {}, businessExists = true): ServiceMocks {
  return {
    folderRepository: createMockFolderRepository(),
    businessRepository: createMockBusinessRepository(businessExists),
    accessScopeService: createMockAccessScopeService(scope),
  };
}

function createService(mocks: ServiceMocks, req: Request = createFakeRequest()): DocumentFolderService {
  return new DocumentFolderService(
    req,
    mocks.folderRepository as unknown as DocumentFolderRepository,
    mocks.businessRepository as unknown as BusinessRepository,
    mocks.accessScopeService as unknown as DocumentAccessScopeService,
  );
}

describe('DocumentFolderService', () => {
  // ────────────────────────────────────────────────────────────────────────
  // createFolder
  // ────────────────────────────────────────────────────────────────────────
  describe('createFolder', () => {
    const dto: CreateFolderDto = { category: DocumentCategory.PAN, name: 'Registration Docs' };

    it('throws UnauthorizedError when the request has no authenticated user', async () => {
      const mocks = createMocks();
      const service = createService(mocks, createFakeRequestNoUser());

      await expect(service.createFolder(BUSINESS_ID, dto)).rejects.toThrow(UnauthorizedError);
    });

    it('throws NotFoundError when the Business does not exist', async () => {
      const mocks = createMocks({}, false);
      const service = createService(mocks);

      await expect(service.createFolder(BUSINESS_ID, dto)).rejects.toThrow(NotFoundError);
      expect(mocks.folderRepository.create).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError when the Business/category is outside the resolved scope', async () => {
      const mocks = createMocks({ businessIds: ['some-other-business'] });
      const service = createService(mocks);

      await expect(service.createFolder(BUSINESS_ID, dto)).rejects.toThrow(ForbiddenError);
      expect(mocks.folderRepository.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when parentFolderId does not exist', async () => {
      const mocks = createMocks();
      mocks.folderRepository.findById.mockResolvedValue(null);
      const service = createService(mocks);

      await expect(service.createFolder(BUSINESS_ID, { ...dto, parentFolderId: PARENT_ID })).rejects.toThrow(NotFoundError);
    });

    it('throws BadRequestError when the parent folder belongs to a different Business', async () => {
      const mocks = createMocks();
      mocks.folderRepository.findById.mockResolvedValue(createMockFolder({ id: PARENT_ID, businessId: 'other-business' }));
      const service = createService(mocks);

      await expect(service.createFolder(BUSINESS_ID, { ...dto, parentFolderId: PARENT_ID })).rejects.toThrow(BadRequestError);
      expect(mocks.folderRepository.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestError when the parent folder belongs to a different category', async () => {
      const mocks = createMocks();
      mocks.folderRepository.findById.mockResolvedValue(
        createMockFolder({ id: PARENT_ID, businessId: BUSINESS_ID, category: DocumentCategory.GST }),
      );
      const service = createService(mocks);

      await expect(service.createFolder(BUSINESS_ID, { ...dto, parentFolderId: PARENT_ID })).rejects.toThrow(BadRequestError);
    });

    it('throws ConflictError on a duplicate sibling name at the same level', async () => {
      const mocks = createMocks();
      mocks.folderRepository.findByBusiness.mockResolvedValue([createMockFolder({ name: 'Registration Docs', parentFolderId: null })]);
      const service = createService(mocks);

      await expect(service.createFolder(BUSINESS_ID, dto)).rejects.toThrow(ConflictError);
      expect(mocks.folderRepository.create).not.toHaveBeenCalled();
    });

    it('allows the same name at a different level (different parentFolderId)', async () => {
      const mocks = createMocks();
      mocks.folderRepository.findByBusiness.mockResolvedValue([createMockFolder({ name: 'Registration Docs', parentFolderId: PARENT_ID })]);
      mocks.folderRepository.create.mockResolvedValue(createMockFolder());
      const service = createService(mocks);

      await expect(service.createFolder(BUSINESS_ID, dto)).resolves.toBeDefined();
    });

    it('creates the folder with a root parentFolderId of null when omitted', async () => {
      const mocks = createMocks();
      mocks.folderRepository.findByBusiness.mockResolvedValue([]);
      const created = createMockFolder();
      mocks.folderRepository.create.mockResolvedValue(created);
      const service = createService(mocks);

      const result = await service.createFolder(BUSINESS_ID, dto);

      expect(mocks.folderRepository.create).toHaveBeenCalledWith(
        { businessId: BUSINESS_ID, category: DocumentCategory.PAN, parentFolderId: null, name: 'Registration Docs', createdById: USER_ID },
        { tenantId: TENANT_ID },
      );
      expect(result).toBe(created);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // renameFolder
  // ────────────────────────────────────────────────────────────────────────
  describe('renameFolder', () => {
    const dto: UpdateFolderDto = { name: 'New Name' };

    it('throws NotFoundError when the folder does not exist', async () => {
      const mocks = createMocks();
      mocks.folderRepository.findById.mockResolvedValue(null);
      const service = createService(mocks);

      await expect(service.renameFolder(FOLDER_ID, dto)).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when the folder is outside the resolved scope', async () => {
      const mocks = createMocks({ businessIds: ['some-other-business'] });
      mocks.folderRepository.findById.mockResolvedValue(createMockFolder());
      const service = createService(mocks);

      await expect(service.renameFolder(FOLDER_ID, dto)).rejects.toThrow(ForbiddenError);
    });

    it('throws ConflictError on a duplicate sibling name', async () => {
      const mocks = createMocks();
      mocks.folderRepository.findById.mockResolvedValue(createMockFolder());
      mocks.folderRepository.findByBusiness.mockResolvedValue([
        createMockFolder({ id: 'other-folder', name: 'New Name', parentFolderId: null }),
      ]);
      const service = createService(mocks);

      await expect(service.renameFolder(FOLDER_ID, dto)).rejects.toThrow(ConflictError);
    });

    it('does not collide with itself when the name is unchanged', async () => {
      const mocks = createMocks();
      const existing = createMockFolder({ name: 'New Name' });
      mocks.folderRepository.findById.mockResolvedValue(existing);
      mocks.folderRepository.findByBusiness.mockResolvedValue([existing]);
      mocks.folderRepository.update.mockResolvedValue(existing);
      const service = createService(mocks);

      await expect(service.renameFolder(FOLDER_ID, dto)).resolves.toBeDefined();
    });

    it('renames the folder', async () => {
      const mocks = createMocks();
      mocks.folderRepository.findById.mockResolvedValue(createMockFolder());
      mocks.folderRepository.findByBusiness.mockResolvedValue([]);
      const updated = createMockFolder({ name: 'New Name' });
      mocks.folderRepository.update.mockResolvedValue(updated);
      const service = createService(mocks);

      const result = await service.renameFolder(FOLDER_ID, dto);

      expect(mocks.folderRepository.update).toHaveBeenCalledWith(FOLDER_ID, { name: 'New Name' }, { tenantId: TENANT_ID });
      expect(result).toBe(updated);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // deleteFolder
  // ────────────────────────────────────────────────────────────────────────
  describe('deleteFolder', () => {
    it('throws NotFoundError when the folder does not exist', async () => {
      const mocks = createMocks();
      mocks.folderRepository.findById.mockResolvedValue(null);
      const service = createService(mocks);

      await expect(service.deleteFolder(FOLDER_ID)).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when the folder is outside the resolved scope', async () => {
      const mocks = createMocks({ businessIds: ['some-other-business'] });
      mocks.folderRepository.findById.mockResolvedValue(createMockFolder());
      const service = createService(mocks);

      await expect(service.deleteFolder(FOLDER_ID)).rejects.toThrow(ForbiddenError);
    });

    it('throws ConflictError when the folder still has a child folder', async () => {
      const mocks = createMocks();
      mocks.folderRepository.findById.mockResolvedValue(createMockFolder());
      mocks.folderRepository.hasChildFolders.mockResolvedValue(true);
      const service = createService(mocks);

      await expect(service.deleteFolder(FOLDER_ID)).rejects.toThrow(ConflictError);
      expect(mocks.folderRepository.delete).not.toHaveBeenCalled();
    });

    it('throws ConflictError when the folder still has a document', async () => {
      const mocks = createMocks();
      mocks.folderRepository.findById.mockResolvedValue(createMockFolder());
      mocks.folderRepository.hasDocuments.mockResolvedValue(true);
      const service = createService(mocks);

      await expect(service.deleteFolder(FOLDER_ID)).rejects.toThrow(ConflictError);
      expect(mocks.folderRepository.delete).not.toHaveBeenCalled();
    });

    it('deletes an empty folder', async () => {
      const mocks = createMocks();
      mocks.folderRepository.findById.mockResolvedValue(createMockFolder());
      mocks.folderRepository.delete.mockResolvedValue(true);
      const service = createService(mocks);

      await service.deleteFolder(FOLDER_ID);

      expect(mocks.folderRepository.delete).toHaveBeenCalledWith(FOLDER_ID, { tenantId: TENANT_ID, userId: USER_ID });
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // listFolders / getFolderById
  // ────────────────────────────────────────────────────────────────────────
  describe('listFolders', () => {
    it('throws NotFoundError when the Business does not exist', async () => {
      const mocks = createMocks({}, false);
      const service = createService(mocks);

      await expect(service.listFolders(BUSINESS_ID, {})).rejects.toThrow(NotFoundError);
    });

    it('delegates to the repository with the scope-derived where clause', async () => {
      const mocks = createMocks({ categories: [DocumentCategory.AUDIT] });
      mocks.folderRepository.findByBusiness.mockResolvedValue([]);
      const service = createService(mocks);

      await service.listFolders(BUSINESS_ID, { category: DocumentCategory.AUDIT });

      expect(mocks.folderRepository.findByBusiness).toHaveBeenCalledWith(
        BUSINESS_ID,
        { category: DocumentCategory.AUDIT, parentFolderId: undefined },
        { tenantId: TENANT_ID },
        { AND: [{ category: { in: [DocumentCategory.AUDIT] } }] },
      );
    });
  });

  describe('getFolderById', () => {
    it('throws NotFoundError when the folder does not exist', async () => {
      const mocks = createMocks();
      mocks.folderRepository.findById.mockResolvedValue(null);
      const service = createService(mocks);

      await expect(service.getFolderById(FOLDER_ID)).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when the folder is outside the resolved scope', async () => {
      const mocks = createMocks({ categories: [DocumentCategory.GST] });
      mocks.folderRepository.findById.mockResolvedValue(createMockFolder({ category: DocumentCategory.PAN }));
      const service = createService(mocks);

      await expect(service.getFolderById(FOLDER_ID)).rejects.toThrow(ForbiddenError);
    });

    it('returns the folder when found and in scope', async () => {
      const mocks = createMocks();
      const folder = createMockFolder();
      mocks.folderRepository.findById.mockResolvedValue(folder);
      const service = createService(mocks);

      await expect(service.getFolderById(FOLDER_ID)).resolves.toBe(folder);
    });
  });
});
