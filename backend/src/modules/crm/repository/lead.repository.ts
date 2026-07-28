import { PrismaClient, Prisma, Lead } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';
import { PaginationQuery, PaginationMeta } from '@shared/types';

/**
 * Domain-shaped search criteria for `LeadRepository.search()`. Mirrors
 * `modules/business/repository/business.repository.ts`.
 */
export interface LeadSearchFilters {
  stageId?: string;
  sourceId?: string;
  /** Matches against `title` (case-insensitive). */
  search?: string;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Lead Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Data access for the `Lead` entity. Inherits tenant scoping, soft delete,
 * and standard CRUD/pagination from `BaseRepository`; adds only the finder
 * method specific to leads. Unlike `ContactRepository`, no `delete()`
 * override is needed — `Lead` now has `deletedAt`/`deletedBy` columns
 * (migration `20260728061640_add_lead_soft_delete`), matching exactly what
 * `BaseRepository.delete()` expects.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class LeadRepository extends BaseRepository<Prisma.LeadDelegate, Lead> {
  constructor(prisma: PrismaClient) {
    super(prisma.lead, prisma);
  }

  async search(
    filters: LeadSearchFilters,
    pagination: PaginationQuery,
    options: RepositoryOptions = {},
  ): Promise<{ data: Lead[]; meta: PaginationMeta }> {
    const where: Prisma.LeadWhereInput = {};

    if (filters.stageId) where.stageId = filters.stageId;
    if (filters.sourceId) where.sourceId = filters.sourceId;
    if (filters.search) where.title = { contains: filters.search, mode: 'insensitive' };

    return this.paginate(pagination, where, options);
  }
}
