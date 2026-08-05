import { PrismaClient, Prisma, Tenant, TenantStatus, SubscriptionStatus } from '@prisma/client';
import { PaginationQuery, PaginationMeta } from '@shared/types';
import { ApiResponseHelper } from '@shared/response/api-response';
import { TenantWithUserCount } from '../mapper/tenant.mapper';
import { TenantUsageDto } from '../dto/master-admin.res.dto';

export interface TenantSearchFilters {
  status?: TenantStatus;
  /** Matches against `name` or `slug` (case-insensitive). */
  search?: string;
}

export interface UpdateTenantLimitsData {
  planCode?: string | null;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionExpiresAt?: Date | null;
  maxUsers?: number | null;
  maxClients?: number | null;
  maxStorageGb?: number | null;
  maxDocuments?: number | null;
  /** PRD §7.4 — per-file upload size ceiling in MB. */
  maxUploadSizeMb?: number | null;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Tenant Repository (Master Admin)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Cross-tenant data access for the platform-admin panel. Deliberately NOT a
 * `BaseRepository<TDelegate, TEntity>` subclass — `Tenant` has no `tenantId`
 * column (it IS the tenant), so `BaseRepository`'s tenant-scoping doesn't
 * apply here; every query in this repository is intentionally unscoped.
 * Mirrors the same "bespoke repository when the shape doesn't fit
 * BaseRepository" precedent as `modules/auth/repository/auth.repository.ts`.
 *
 * `getUsage()` aggregates across Business/Client/Document, none of which
 * carry a Prisma relation back to `Tenant` (they're scoped by a plain
 * `tenantId` column, enforced at the application layer — see those models'
 * header comments in schema.prisma), so these are raw cross-model counts
 * rather than a Prisma `include`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class TenantRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async search(
    filters: TenantSearchFilters,
    pagination: PaginationQuery,
  ): Promise<{ data: TenantWithUserCount[]; meta: PaginationMeta }> {
    const where: Prisma.TenantWhereInput = { deletedAt: null };

    if (filters.status) where.status = filters.status;

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { slug: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const skip = (page - 1) * limit;
    const orderBy = pagination.sortBy ? { [pagination.sortBy]: pagination.sortOrder || 'desc' } : undefined;

    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: { _count: { select: { users: true } } },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return {
      data,
      meta: ApiResponseHelper.buildPaginationMeta(page, limit, total),
    };
  }

  async findById(id: string): Promise<Tenant | null> {
    return this.prisma.tenant.findFirst({ where: { id, deletedAt: null } });
  }

  /**
   * Batch name lookup for a set of tenant IDs — backs the "tenant name on
   * every audit row" requirement in `MasterAdminAuditService`, which only
   * has raw `tenantId` columns to work with (`AuditLog` has no Prisma
   * relation back to `Tenant`, same as `Business`/`Client`/`Document` — see
   * this class's own header comment). One query for the whole page of
   * results rather than N+1. Deliberately does NOT filter `deletedAt: null`
   * — a soft-deleted tenant's historical audit rows should still resolve to
   * its name rather than silently falling back to "Unknown".
   */
  async findNamesByIds(ids: string[]): Promise<Pick<Tenant, 'id' | 'name'>[]> {
    if (ids.length === 0) return [];
    return this.prisma.tenant.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
  }

  async create(data: Prisma.TenantUncheckedCreateInput, tx?: Prisma.TransactionClient): Promise<Tenant> {
    const client = tx ?? this.prisma;
    return client.tenant.create({ data });
  }

  async updateStatus(id: string, status: TenantStatus): Promise<Tenant> {
    return this.prisma.tenant.update({ where: { id }, data: { status } });
  }

  async updateLimits(id: string, data: UpdateTenantLimitsData): Promise<Tenant> {
    return this.prisma.tenant.update({ where: { id }, data });
  }

  /** Resource consumption for one tenant — the "usage view" from PRD §4.1. */
  async getUsage(tenantId: string): Promise<TenantUsageDto> {
    const [userCount, businessCount, clientCount, documentCount, storage] = await Promise.all([
      this.prisma.user.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.business.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.client.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.document.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.document.aggregate({
        where: { tenantId, deletedAt: null },
        _sum: { sizeBytes: true },
      }),
    ]);

    return {
      userCount,
      businessCount,
      clientCount,
      documentCount,
      storageUsedBytes: storage._sum.sizeBytes ?? 0,
    };
  }
}
