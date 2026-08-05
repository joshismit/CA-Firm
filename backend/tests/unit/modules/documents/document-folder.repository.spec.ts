jest.mock('@config/database', () => ({ prisma: {} }));

import { DocumentCategory } from '@prisma/client';
import { DocumentFolderRepository } from '@modules/documents/repository/document-folder.repository';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DocumentFolderRepository — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Mirrors `document.repository.spec.ts` — exercises the real repository code
 * against a hand-built mock Prisma delegate, no real database.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const BUSINESS_ID = 'business-22222222-2222-2222-2222-222222222222';

function createMockDelegate() {
  return {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  };
}

describe('DocumentFolderRepository', () => {
  function createRepository() {
    const folderDelegate = createMockDelegate();
    const documentDelegate = createMockDelegate();
    const mockPrisma = { documentFolder: folderDelegate, document: documentDelegate };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repository = new DocumentFolderRepository(mockPrisma as any);
    return { repository, folderDelegate, documentDelegate };
  }

  describe('tenant isolation', () => {
    it('throws when no tenantId is provided and ignoreTenant is not set', async () => {
      const { repository } = createRepository();
      await expect(repository.findById('folder-1', {})).rejects.toThrow(/tenantId is required/);
    });

    it('scopes findByBusiness to the given tenantId', async () => {
      const { repository, folderDelegate } = createRepository();
      folderDelegate.findMany.mockResolvedValue([]);

      await repository.findByBusiness(BUSINESS_ID, {}, { tenantId: TENANT_ID });

      expect(folderDelegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_ID, businessId: BUSINESS_ID }) }),
      );
    });
  });

  describe('findByBusiness', () => {
    it('filters by category when provided', async () => {
      const { repository, folderDelegate } = createRepository();
      folderDelegate.findMany.mockResolvedValue([]);

      await repository.findByBusiness(BUSINESS_ID, { category: DocumentCategory.GST }, { tenantId: TENANT_ID });

      expect(folderDelegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ category: DocumentCategory.GST }) }),
      );
    });

    it('filters by parentFolderId when provided (including null, for root-level folders)', async () => {
      const { repository, folderDelegate } = createRepository();
      folderDelegate.findMany.mockResolvedValue([]);

      await repository.findByBusiness(BUSINESS_ID, { parentFolderId: null }, { tenantId: TENANT_ID });

      const where = folderDelegate.findMany.mock.calls[0][0].where;
      expect(where).toHaveProperty('parentFolderId', null);
    });

    it('omits parentFolderId from the where clause when not provided', async () => {
      const { repository, folderDelegate } = createRepository();
      folderDelegate.findMany.mockResolvedValue([]);

      await repository.findByBusiness(BUSINESS_ID, {}, { tenantId: TENANT_ID });

      const where = folderDelegate.findMany.mock.calls[0][0].where;
      expect(where).not.toHaveProperty('parentFolderId');
    });

    it('ANDs an extra scopeWhere fragment onto the built where clause', async () => {
      const { repository, folderDelegate } = createRepository();
      folderDelegate.findMany.mockResolvedValue([]);
      const scopeWhere = { category: { in: [DocumentCategory.AUDIT] } };

      await repository.findByBusiness(BUSINESS_ID, {}, { tenantId: TENANT_ID }, scopeWhere);

      expect(folderDelegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ AND: [{ businessId: BUSINESS_ID }, scopeWhere] }),
        }),
      );
    });

    it('orders results by name ascending', async () => {
      const { repository, folderDelegate } = createRepository();
      folderDelegate.findMany.mockResolvedValue([]);

      await repository.findByBusiness(BUSINESS_ID, {}, { tenantId: TENANT_ID });

      expect(folderDelegate.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { name: 'asc' } }));
    });
  });

  describe('hasChildFolders', () => {
    it('returns true when a child folder exists', async () => {
      const { repository, folderDelegate } = createRepository();
      folderDelegate.count.mockResolvedValue(1);

      const result = await repository.hasChildFolders('folder-1', { tenantId: TENANT_ID });

      expect(folderDelegate.count).toHaveBeenCalledWith({ where: { parentFolderId: 'folder-1', deletedAt: null, tenantId: TENANT_ID } });
      expect(result).toBe(true);
    });

    it('returns false when no child folder exists', async () => {
      const { repository, folderDelegate } = createRepository();
      folderDelegate.count.mockResolvedValue(0);

      const result = await repository.hasChildFolders('folder-1', { tenantId: TENANT_ID });

      expect(result).toBe(false);
    });
  });

  describe('hasDocuments', () => {
    it('queries the documents table (not the folder delegate) scoped to tenant + folderId', async () => {
      const { repository, documentDelegate } = createRepository();
      documentDelegate.count.mockResolvedValue(1);

      const result = await repository.hasDocuments('folder-1', { tenantId: TENANT_ID });

      expect(documentDelegate.count).toHaveBeenCalledWith({ where: { folderId: 'folder-1', deletedAt: null, tenantId: TENANT_ID } });
      expect(result).toBe(true);
    });

    it('returns false when no document references the folder', async () => {
      const { repository, documentDelegate } = createRepository();
      documentDelegate.count.mockResolvedValue(0);

      const result = await repository.hasDocuments('folder-1', { tenantId: TENANT_ID });

      expect(result).toBe(false);
    });

    it('throws when no tenantId is provided and ignoreTenant is not set', async () => {
      const { repository } = createRepository();
      await expect(repository.hasDocuments('folder-1', {})).rejects.toThrow(/tenantId is required/);
    });
  });
});
