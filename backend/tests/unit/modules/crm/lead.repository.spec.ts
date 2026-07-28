/**
 * See the identical comment in tests/unit/modules/business/business.service.spec.ts
 * for why @config/database is stubbed — LeadRepository/LeadStageRepository
 * are instantiated directly against a hand-built mock PrismaClient below, so
 * the real singleton is never touched, but importing anything under
 * `@modules/*` still transitively imports it.
 */
jest.mock('@config/database', () => ({ prisma: {} }));

import { LeadRepository } from '@modules/crm/repository/lead.repository';
import { LeadStageRepository } from '@modules/crm/repository/lead-stage.repository';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * LeadRepository / LeadStageRepository — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Unlike the service specs (which mock the repository as a black box), these
 * tests exercise the REAL repository code — `BaseRepository`'s
 * `applyFilters()`/`paginate()` and `LeadRepository.search()`'s own
 * where-clause building — against a hand-built mock Prisma delegate. This
 * proves the actual query-construction logic (tenant scoping, soft-delete
 * filtering, search/sort/pagination shaping) without touching a real
 * database. No equivalent file exists for Business/Contacts (their unit
 * suites only cover the service layer); this is a genuinely new test
 * pattern for this codebase, added because the request specifically asked
 * for direct repository-layer coverage.
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

describe('LeadRepository', () => {
  function createRepository() {
    const delegate = createMockDelegate();
    const mockPrisma = { lead: delegate };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repository = new LeadRepository(mockPrisma as any);
    return { repository, delegate };
  }

  // ────────────────────────────────────────────────────────────────────────
  // Tenant isolation
  // ────────────────────────────────────────────────────────────────────────
  describe('tenant isolation', () => {
    it('throws when no tenantId is provided and ignoreTenant is not set', async () => {
      const { repository } = createRepository();

      await expect(repository.findById('lead-1', {})).rejects.toThrow(/tenantId is required/);
    });

    it('scopes findById to the given tenantId', async () => {
      const { repository, delegate } = createRepository();
      delegate.findFirst.mockResolvedValue(null);

      await repository.findById('lead-1', { tenantId: TENANT_ID });

      expect(delegate.findFirst).toHaveBeenCalledWith({
        where: { id: 'lead-1', deletedAt: null, tenantId: TENANT_ID },
        include: undefined,
      });
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

      await repository.findById('lead-1', { tenantId: TENANT_ID, ignoreSoftDelete: true });

      const where = delegate.findFirst.mock.calls[0][0].where;
      expect(where).not.toHaveProperty('deletedAt');
    });

    it('delete() sets deletedAt and deletedBy via updateMany (Lead has both columns, unlike Contact)', async () => {
      const { repository, delegate } = createRepository();
      delegate.updateMany.mockResolvedValue({ count: 1 });

      const result = await repository.delete('lead-1', { tenantId: TENANT_ID, userId: 'user-1' });

      expect(delegate.updateMany).toHaveBeenCalledWith({
        where: { id: 'lead-1', deletedAt: null, tenantId: TENANT_ID },
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
      const created = { id: 'lead-1', title: 'New Lead' };
      delegate.create.mockResolvedValue(created);

      const result = await repository.create({ title: 'New Lead' }, { tenantId: TENANT_ID });

      expect(delegate.create).toHaveBeenCalledWith({ data: { title: 'New Lead', tenantId: TENANT_ID }, include: undefined });
      expect(result).toBe(created);
    });

    it('update() applies via updateMany then re-fetches by id', async () => {
      const { repository, delegate } = createRepository();
      delegate.updateMany.mockResolvedValue({ count: 1 });
      const refetched = { id: 'lead-1', title: 'Renamed' };
      delegate.findFirst.mockResolvedValue(refetched);

      const result = await repository.update('lead-1', { title: 'Renamed' }, { tenantId: TENANT_ID });

      expect(delegate.updateMany).toHaveBeenCalledWith({
        where: { id: 'lead-1', deletedAt: null, tenantId: TENANT_ID },
        data: { title: 'Renamed' },
      });
      expect(delegate.findFirst).toHaveBeenCalledWith({
        where: { id: 'lead-1', deletedAt: null, tenantId: TENANT_ID },
        include: undefined,
      });
      expect(result).toBe(refetched);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Search (filters)
  // ────────────────────────────────────────────────────────────────────────
  describe('search — filters', () => {
    it('builds an insensitive title-contains clause for `search`', async () => {
      const { repository, delegate } = createRepository();
      delegate.findMany.mockResolvedValue([]);
      delegate.count.mockResolvedValue(0);

      await repository.search({ search: 'gst advisory' }, { page: 1, limit: 20 }, { tenantId: TENANT_ID });

      expect(delegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ title: { contains: 'gst advisory', mode: 'insensitive' } }),
        }),
      );
    });

    it('filters by stageId when provided', async () => {
      const { repository, delegate } = createRepository();
      delegate.findMany.mockResolvedValue([]);
      delegate.count.mockResolvedValue(0);

      await repository.search({ stageId: 'stage-1' }, { page: 1, limit: 20 }, { tenantId: TENANT_ID });

      expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ stageId: 'stage-1' }) }));
    });

    it('filters by sourceId when provided', async () => {
      const { repository, delegate } = createRepository();
      delegate.findMany.mockResolvedValue([]);
      delegate.count.mockResolvedValue(0);

      await repository.search({ sourceId: 'source-1' }, { page: 1, limit: 20 }, { tenantId: TENANT_ID });

      expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ sourceId: 'source-1' }) }));
    });

    it('omits filter keys entirely when not provided (no accidental `undefined` filtering)', async () => {
      const { repository, delegate } = createRepository();
      delegate.findMany.mockResolvedValue([]);
      delegate.count.mockResolvedValue(0);

      await repository.search({}, { page: 1, limit: 20 }, { tenantId: TENANT_ID });

      const where = delegate.findMany.mock.calls[0][0].where;
      expect(where).not.toHaveProperty('stageId');
      expect(where).not.toHaveProperty('sourceId');
      expect(where).not.toHaveProperty('title');
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

      await repository.search({}, { page: 1, limit: 20, sortBy: 'expectedCloseDate', sortOrder: 'asc' }, { tenantId: TENANT_ID });

      expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { expectedCloseDate: 'asc' } }));
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

describe('LeadStageRepository', () => {
  function createRepository() {
    const delegate = createMockDelegate();
    const mockPrisma = { leadStage: delegate };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repository = new LeadStageRepository(mockPrisma as any);
    return { repository, delegate };
  }

  it('listAll() ignores soft-delete filtering (LeadStage has no deletedAt column)', async () => {
    const { repository, delegate } = createRepository();
    delegate.findMany.mockResolvedValue([]);

    await repository.listAll({ tenantId: TENANT_ID });

    const where = delegate.findMany.mock.calls[0][0].where;
    expect(where).not.toHaveProperty('deletedAt');
    expect(where).toEqual({ tenantId: TENANT_ID });
  });

  it('listAll() still scopes by tenantId (tenant-scoped, unlike BusinessType)', async () => {
    const { repository } = createRepository();

    await expect(repository.listAll({})).rejects.toThrow(/tenantId is required/);
  });

  it('listAll() orders by `order` ascending, for pipeline display', async () => {
    const { repository, delegate } = createRepository();
    delegate.findMany.mockResolvedValue([]);

    await repository.listAll({ tenantId: TENANT_ID });

    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { order: 'asc' } }),
    );
  });

  it('listAll() returns the stages as-is', async () => {
    const { repository, delegate } = createRepository();
    const stages = [
      { id: 'stage-1', tenantId: TENANT_ID, name: 'New', order: 1 },
      { id: 'stage-2', tenantId: TENANT_ID, name: 'Proposal', order: 2 },
    ];
    delegate.findMany.mockResolvedValue(stages);

    const result = await repository.listAll({ tenantId: TENANT_ID });

    expect(result).toBe(stages);
  });
});
