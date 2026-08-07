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

/**
 * PRD §13.1 Global Search — `Lead` has no company/email/phone columns of its
 * own; those are served from the linked `Business`/`Contact`'s own columns
 * (documented interpretation of "Lead Company"/"Lead Email"/"Lead Phone" —
 * see `LeadRepository.findForGlobalSearch()`). A lead with neither linked
 * only carries `business`/`contact` as `null`.
 */
export interface LeadGlobalSearchRow extends Lead {
  business: { name: string } | null;
  contact: { firstName: string; lastName: string; email: string | null; phone: string | null } | null;
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

  /**
   * PRD §13.1 Global Search — "Lead Name" is `title` (`contains`, backed by
   * the `title` trigram GIN index); "Lead Company"/"Lead Email"/"Lead Phone"
   * match the linked `Business.name`/`Contact.email`/`Contact.phone` via
   * relation filters (see `LeadGlobalSearchRow`'s doc comment). Deliberately
   * separate from `search()` — see `BusinessRepository
   * .findForGlobalSearch()`'s identical reasoning. Uses `paginate()`'s
   * `include` support directly (not exposed through this class's other typed
   * methods), so the result is cast to `LeadGlobalSearchRow[]` — the actual
   * runtime shape `include` produces, which `BaseRepository.paginate()`'s
   * generic `Entity[]` return type doesn't statically capture.
   */
  async findForGlobalSearch(search: string, limit: number, options: RepositoryOptions = {}): Promise<LeadGlobalSearchRow[]> {
    const where: Prisma.LeadWhereInput = {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { business: { name: { contains: search, mode: 'insensitive' } } },
        { contact: { email: { contains: search, mode: 'insensitive' } } },
        { contact: { phone: { contains: search, mode: 'insensitive' } } },
      ],
    };

    const { data } = await this.paginate(
      { page: 1, limit, sortBy: 'createdAt', sortOrder: 'desc' },
      where,
      options,
      { business: { select: { name: true } }, contact: { select: { firstName: true, lastName: true, email: true, phone: true } } },
    );
    return data as unknown as LeadGlobalSearchRow[];
  }
}
