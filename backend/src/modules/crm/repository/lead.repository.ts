import { PrismaClient, Prisma, Lead, LeadPriority } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';
import { PaginationQuery, PaginationMeta } from '@shared/types';

/**
 * Domain-shaped search criteria for `LeadRepository.search()`. Mirrors
 * `modules/business/repository/business.repository.ts`.
 */
export interface LeadSearchFilters {
  stageId?: string;
  sourceId?: string;
  priority?: LeadPriority;
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
/** PRD §8.10 — CRM dashboard counts. See `LeadService.getDashboardStats()` for the rest (converted/archived/upcoming-follow-ups, composed from `ClientRepository`/`TaskService`). */
export interface LeadDashboardCounts {
  totalLeads: number;
  /** Sent, and neither accepted nor rejected yet. */
  activeProposals: number;
  leadsBySource: { sourceId: string; sourceName: string; count: number }[];
}

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
    if (filters.priority) where.priority = filters.priority;
    if (filters.search) where.title = { contains: filters.search, mode: 'insensitive' };

    return this.paginate(pagination, where, options);
  }

  async getDashboardStats(options: RepositoryOptions = {}): Promise<LeadDashboardCounts> {
    const where = this.applyFilters({}, options);
    const client = this.getClient(options.tx);

    const [totalLeads, activeProposals, sourceGroups, sources] = await Promise.all([
      this.count({}, options),
      this.count(
        { proposalSentAt: { not: null }, proposalAcceptedAt: null, proposalRejectedAt: null },
        options,
      ),
      client.groupBy({ by: ['sourceId'], where, _count: true }),
      this.prisma.leadSource.findMany({ where: { tenantId: options.tenantId } }),
    ]);

    const sourceNameById = new Map(sources.map((source) => [source.id, source.name]));
    const leadsBySource = sourceGroups.map((group) => ({
      sourceId: group.sourceId,
      sourceName: sourceNameById.get(group.sourceId) ?? 'Unknown',
      count: group._count,
    }));

    return { totalLeads, activeProposals, leadsBySource };
  }
}
