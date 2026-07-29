/**
 * See the identical comment in tests/unit/modules/business/business.service.spec.ts
 * for why @config/database is stubbed — DocumentRepository is instantiated
 * directly against a hand-built mock PrismaClient below, so the real
 * singleton is never touched, but importing anything under `@modules/*`
 * still transitively imports it.
 */
jest.mock('@config/database', () => ({ prisma: {} }));

import { DocumentCategory } from '@prisma/client';
import { DocumentRepository } from '@modules/documents/repository/document.repository';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DocumentRepository — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the REAL repository code — `BaseRepository`'s
 * `applyFilters()`/`paginate()` and `DocumentRepository.search()`'s own
 * where-clause building — against a hand-built mock Prisma delegate. Proves
 * the actual query-construction logic (tenant scoping, soft-delete
 * filtering, search/sort/pagination shaping) without touching a real
 * database. Mirrors `tests/unit/modules/crm/lead.repository.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';

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

describe('DocumentRepository', () => {
  function createRepository() {
    const delegate = createMockDelegate();
    const mockPrisma = { document: delegate };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repository = new DocumentRepository(mockPrisma as any);
    return { repository, delegate };
  }

  // ────────────────────────────────────────────────────────────────────────
  // Tenant isolation
  // ────────────────────────────────────────────────────────────────────────
  describe('tenant isolation', () => {
    it('throws when no tenantId is provided and ignoreTenant is not set', async () => {
      const { repository } = createRepository();

      await expect(repository.findById('doc-1', {})).rejects.toThrow(/tenantId is required/);
    });

    it('scopes findById to the given tenantId', async () => {
      const { repository, delegate } = createRepository();
      delegate.findFirst.mockResolvedValue(null);

      await repository.findById('doc-1', { tenantId: TENANT_ID });

      expect(delegate.findFirst).toHaveBeenCalledWith({
        where: { id: 'doc-1', deletedAt: null, tenantId: TENANT_ID },
        include: undefined,
      });
    });

    it('scopes search() to the given tenantId', async () => {
      const { repository, delegate } = createRepository();
      delegate.findMany.mockResolvedValue([]);
      delegate.count.mockResolvedValue(0);

      await repository.search({}, { page: 1, limit: 20 }, { tenantId: TENANT_ID });

      expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_ID }) }));
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Soft delete
  // ────────────────────────────────────────────────────────────────────────
  describe('soft delete', () => {
    it('excludes soft-deleted rows by default (deletedAt: null in the where clause)', async () => {
      const { repository, delegate } = createRepository();
      delegate.findMany.mockResolvedValue([]);

      await repository.search({}, { page: 1, limit: 20 }, { tenantId: TENANT_ID });

      expect(delegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
      );
    });

    it('includes soft-deleted rows when ignoreSoftDelete is passed', async () => {
      const { repository, delegate } = createRepository();
      delegate.findFirst.mockResolvedValue(null);

      await repository.findById('doc-1', { tenantId: TENANT_ID, ignoreSoftDelete: true });

      const where = delegate.findFirst.mock.calls[0][0].where;
      expect(where).not.toHaveProperty('deletedAt');
    });

    it('delete() sets deletedAt and deletedBy via updateMany', async () => {
      const { repository, delegate } = createRepository();
      delegate.updateMany.mockResolvedValue({ count: 1 });

      const result = await repository.delete('doc-1', { tenantId: TENANT_ID, userId: 'user-1' });

      expect(delegate.updateMany).toHaveBeenCalledWith({
        where: { id: 'doc-1', deletedAt: null, tenantId: TENANT_ID },
        data: { deletedAt: expect.any(Date), deletedBy: 'user-1' },
      });
      expect(result).toBe(true);
    });

    it('delete() returns false when no row matched (already deleted / wrong tenant)', async () => {
      const { repository, delegate } = createRepository();
      delegate.updateMany.mockResolvedValue({ count: 0 });

      const result = await repository.delete('missing-id', { tenantId: TENANT_ID, userId: 'user-1' });

      expect(result).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // CRUD
  // ────────────────────────────────────────────────────────────────────────
  describe('CRUD', () => {
    it('create() stamps tenantId onto the payload', async () => {
      const { repository, delegate } = createRepository();
      const created = { id: 'doc-1', fileName: 'pan-card.pdf' };
      delegate.create.mockResolvedValue(created);

      const result = await repository.create({ fileName: 'pan-card.pdf' }, { tenantId: TENANT_ID });

      expect(delegate.create).toHaveBeenCalledWith({
        data: { fileName: 'pan-card.pdf', tenantId: TENANT_ID },
        include: undefined,
      });
      expect(result).toBe(created);
    });

    it('update() applies via updateMany then re-fetches by id', async () => {
      const { repository, delegate } = createRepository();
      delegate.updateMany.mockResolvedValue({ count: 1 });
      const refetched = { id: 'doc-1', category: DocumentCategory.GST };
      delegate.findFirst.mockResolvedValue(refetched);

      const result = await repository.update('doc-1', { category: DocumentCategory.GST }, { tenantId: TENANT_ID });

      expect(delegate.updateMany).toHaveBeenCalledWith({
        where: { id: 'doc-1', deletedAt: null, tenantId: TENANT_ID },
        data: { category: DocumentCategory.GST },
      });
      expect(result).toBe(refetched);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Search (filters)
  // ────────────────────────────────────────────────────────────────────────
  describe('search — filters', () => {
    it('builds an insensitive fileName-contains clause for `search`', async () => {
      const { repository, delegate } = createRepository();
      delegate.findMany.mockResolvedValue([]);
      delegate.count.mockResolvedValue(0);

      await repository.search({ search: 'pan card' }, { page: 1, limit: 20 }, { tenantId: TENANT_ID });

      expect(delegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ fileName: { contains: 'pan card', mode: 'insensitive' } }),
        }),
      );
    });

    it('filters by category when provided', async () => {
      const { repository, delegate } = createRepository();
      delegate.findMany.mockResolvedValue([]);
      delegate.count.mockResolvedValue(0);

      await repository.search({ category: DocumentCategory.GST }, { page: 1, limit: 20 }, { tenantId: TENANT_ID });

      expect(delegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ category: DocumentCategory.GST }) }),
      );
    });

    it('filters by businessId when provided', async () => {
      const { repository, delegate } = createRepository();
      delegate.findMany.mockResolvedValue([]);
      delegate.count.mockResolvedValue(0);

      await repository.search({ businessId: 'business-1' }, { page: 1, limit: 20 }, { tenantId: TENANT_ID });

      expect(delegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ businessId: 'business-1' }) }),
      );
    });

    it('omits filter keys entirely when not provided (no accidental `undefined` filtering)', async () => {
      const { repository, delegate } = createRepository();
      delegate.findMany.mockResolvedValue([]);
      delegate.count.mockResolvedValue(0);

      await repository.search({}, { page: 1, limit: 20 }, { tenantId: TENANT_ID });

      const where = delegate.findMany.mock.calls[0][0].where;
      expect(where).not.toHaveProperty('category');
      expect(where).not.toHaveProperty('businessId');
      expect(where).not.toHaveProperty('fileName');
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Pagination & sorting
  // ────────────────────────────────────────────────────────────────────────
  describe('pagination and sorting', () => {
    it('computes skip/take from page/limit', async () => {
      const { repository, delegate } = createRepository();
      delegate.findMany.mockResolvedValue([]);
      delegate.count.mockResolvedValue(45);

      const result = await repository.search({}, { page: 3, limit: 10 }, { tenantId: TENANT_ID });

      expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
      expect(result.meta).toEqual({ page: 3, limit: 10, total: 45, totalPages: 5, hasNextPage: true, hasPrevPage: true });
    });

    it('builds orderBy from sortBy/sortOrder when provided', async () => {
      const { repository, delegate } = createRepository();
      delegate.findMany.mockResolvedValue([]);
      delegate.count.mockResolvedValue(0);

      await repository.search({}, { page: 1, limit: 20, sortBy: 'fileName', sortOrder: 'asc' }, { tenantId: TENANT_ID });

      expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { fileName: 'asc' } }));
    });

    it('defaults orderBy to undefined when sortBy is not provided', async () => {
      const { repository, delegate } = createRepository();
      delegate.findMany.mockResolvedValue([]);
      delegate.count.mockResolvedValue(0);

      await repository.search({}, { page: 1, limit: 20 }, { tenantId: TENANT_ID });

      expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: undefined }));
    });
  });
});
