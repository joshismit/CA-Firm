import { PrismaClient, Prisma, Contact } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';
import { PaginationQuery, PaginationMeta } from '@shared/types';

export interface ContactSearchFilters {
  /** Filters to contacts with at least one ContactRole for this business (indirect - Contact has no direct businessId column). */
  businessId?: string;
  /** Matches against firstName, lastName, email, or phone (case-insensitive). */
  search?: string;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Contact Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Data access for the `Contact` entity. Inherits tenant scoping and standard
 * CRUD/pagination from `BaseRepository`; adds the finder method specific to
 * contacts and overrides `delete()` — see that method's comment.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class ContactRepository extends BaseRepository<Prisma.ContactDelegate, Contact> {
  constructor(prisma: PrismaClient) {
    super(prisma.contact, prisma);
  }

  async search(
    filters: ContactSearchFilters,
    pagination: PaginationQuery,
    options: RepositoryOptions = {},
  ): Promise<{ data: Contact[]; meta: PaginationMeta }> {
    const where: Prisma.ContactWhereInput = {};

    if (filters.businessId) {
      where.roles = { some: { businessId: filters.businessId } };
    }

    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.paginate(pagination, where, options);
  }

  /**
   * Contact has no `deletedBy` column (unlike Project/Task/Business) —
   * BaseRepository.delete() unconditionally includes `deletedBy` in its
   * update payload, which Prisma rejects as an unknown field for this model.
   * Overridden here with identical soft-delete semantics minus that field,
   * rather than modifying the shared BaseRepository (used by Project/Task/
   * Business, which all DO have deletedBy) and risking their already-tested
   * behavior.
   */
  async delete(id: string, options: RepositoryOptions = {}): Promise<boolean> {
    const where = this.applyFilters({ id }, options);
    const client = this.getClient(options.tx);
    const result = (await client.updateMany({ where, data: { deletedAt: new Date() } })) as { count: number };
    return result.count > 0;
  }

  /**
   * PRD §13.1 Global Search — Name/Phone/Email use `contains` (Name backed by
   * the `firstName`/`lastName` trigram GIN index; Phone/Email match this
   * class's own `search()` precedent above). PAN is a structured code
   * (`startsWith`, backed by the existing `[tenantId, pan]` index).
   * Deliberately separate from `search()` — see `BusinessRepository
   * .findForGlobalSearch()`'s identical reasoning.
   */
  async findForGlobalSearch(search: string, limit: number, options: RepositoryOptions = {}): Promise<Contact[]> {
    const where: Prisma.ContactWhereInput = {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { pan: { startsWith: search, mode: 'insensitive' } },
      ],
    };

    const { data } = await this.paginate({ page: 1, limit, sortBy: 'createdAt', sortOrder: 'desc' }, where, options);
    return data;
  }
}
