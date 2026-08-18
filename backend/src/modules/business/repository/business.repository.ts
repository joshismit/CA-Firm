import { PrismaClient, Prisma, Business, BusinessStatus } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';
import { PaginationQuery, PaginationMeta } from '@shared/types';

/**
 * Domain-shaped search criteria for `BusinessRepository.search()`.
 * Deliberately Prisma-agnostic — the repository translates this into a
 * `Prisma.BusinessWhereInput`, so the service layer never imports Prisma
 * query-builder types. Mirrors `modules/projects/repository/project.repository.ts`.
 */
export interface BusinessSearchFilters {
  typeId?: string;
  status?: BusinessStatus;
  /** Matches against `name`, `legalName`, `pan`, `gstin`, `phone`, or `email` (case-insensitive). */
  search?: string;
  /** PRD §8.9 — businesses with a `BusinessAssignment` for this user. */
  assignedStaffUserId?: string;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Business Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Data access for the `Business` entity. Inherits tenant scoping, soft
 * delete, and standard CRUD/pagination from `BaseRepository`; adds only the
 * finder method specific to businesses.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class BusinessRepository extends BaseRepository<Prisma.BusinessDelegate, Business> {
  constructor(prisma: PrismaClient) {
    super(prisma.business, prisma);
  }

  /**
   * Paginated search combining the standard list filters. Builds the Prisma
   * `where` clause internally so the service layer only ever deals with
   * `BusinessSearchFilters`.
   */
  async search(
    filters: BusinessSearchFilters,
    pagination: PaginationQuery,
    options: RepositoryOptions = {},
  ): Promise<{ data: Business[]; meta: PaginationMeta }> {
    const where: Prisma.BusinessWhereInput = {};

    if (filters.typeId) where.typeId = filters.typeId;
    if (filters.status) where.status = filters.status;
    if (filters.assignedStaffUserId) {
      where.assignments = { some: { userId: filters.assignedStaffUserId } };
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { legalName: { contains: filters.search, mode: 'insensitive' } },
        { pan: { contains: filters.search, mode: 'insensitive' } },
        { gstin: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.paginate(pagination, where, options);
  }

  /**
   * PRD §13.1 Global Search — Name/Trade Name are free-text (`contains`,
   * backed by the `name`/`tradeName` trigram GIN indexes); PAN/GST/DIN are
   * structured codes (`startsWith`, backed by the existing `[tenantId, pan]`/
   * `[tenantId, gstin]`/`[tenantId, din]` composite indexes); Phone/Email use
   * `contains`, matching this class's own `search()` precedent above.
   * Deliberately a separate method from `search()` — that one backs the
   * paginated Business list page and has its own tested contract; this one
   * is tuned for a small, capped, cross-entity result set.
   */
  async findForGlobalSearch(search: string, limit: number, options: RepositoryOptions = {}): Promise<Business[]> {
    const where: Prisma.BusinessWhereInput = {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { tradeName: { contains: search, mode: 'insensitive' } },
        { pan: { startsWith: search, mode: 'insensitive' } },
        { gstin: { startsWith: search, mode: 'insensitive' } },
        { din: { startsWith: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    };

    const { data } = await this.paginate({ page: 1, limit, sortBy: 'createdAt', sortOrder: 'desc' }, where, options);
    return data;
  }
}
