import { PrismaClient, Prisma, ComplianceFiling, ComplianceCategory, ComplianceFilingStatus } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';
import { PaginationQuery, PaginationMeta } from '@shared/types';

export interface ComplianceFilingSearchFilters {
  category: ComplianceCategory;
  /** Matches against reference or period (case-insensitive). */
  search?: string;
  status?: ComplianceFilingStatus;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Compliance Filing Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Data access for the `ComplianceFiling` entity — one generic table shared
 * by all four Compliance areas (GST/ITR/TDS/MCA), discriminated by
 * `category`. Inherits tenant scoping and standard CRUD/pagination from
 * `BaseRepository`, but overrides `delete()` — `ComplianceFiling` has
 * `deletedAt` but no `deletedBy` column (same situation as
 * `ContactRepository`/`RoleRepository`, see those classes' comments).
 *
 * Every method that targets a single row (`findByIdInCategory`) filters by
 * `category` in addition to `tenantId` — a filing's `id` is a global UUID,
 * so without this a caller hitting `/itr/:id` with a real GST filing's ID
 * (same tenant) would otherwise be able to read/mutate it through the wrong
 * category's routes. Mirrors `modules/contacts/repository/contact.repository.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class ComplianceFilingRepository extends BaseRepository<Prisma.ComplianceFilingDelegate, ComplianceFiling> {
  constructor(prisma: PrismaClient) {
    super(prisma.complianceFiling, prisma);
  }

  async search(
    filters: ComplianceFilingSearchFilters,
    pagination: PaginationQuery,
    options: RepositoryOptions = {},
  ): Promise<{ data: ComplianceFiling[]; meta: PaginationMeta }> {
    const where: Prisma.ComplianceFilingWhereInput = { category: filters.category };

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.search) {
      where.OR = [
        { reference: { contains: filters.search, mode: 'insensitive' } },
        { period: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.paginate(pagination, where, options);
  }

  async findByIdInCategory(
    id: string,
    category: ComplianceCategory,
    options: RepositoryOptions = {},
  ): Promise<ComplianceFiling | null> {
    return this.findFirst({ id, category }, options);
  }

  /**
   * `ComplianceFiling` has no `deletedBy` column — BaseRepository.delete()
   * unconditionally includes `deletedBy` in its update payload, which
   * Prisma rejects as an unknown field for this model. Overridden here with
   * identical soft-delete semantics minus that field.
   */
  async delete(id: string, options: RepositoryOptions = {}): Promise<boolean> {
    const where = this.applyFilters({ id }, options);
    const client = this.getClient(options.tx);
    const result = (await client.updateMany({ where, data: { deletedAt: new Date() } })) as { count: number };
    return result.count > 0;
  }
}
