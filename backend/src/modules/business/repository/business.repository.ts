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
  /** Matches against `name`, `legalName`, `pan`, or `gstin` (case-insensitive). */
  search?: string;
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

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { legalName: { contains: filters.search, mode: 'insensitive' } },
        { pan: { contains: filters.search, mode: 'insensitive' } },
        { gstin: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.paginate(pagination, where, options);
  }
}
