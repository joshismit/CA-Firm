import { PrismaClient, Prisma, AuditLog, AuditEventType } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';
import { PaginationQuery, PaginationMeta } from '@shared/types';

export interface AuditLogSearchFilters {
  search?: string;
  eventType?: AuditEventType;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  from?: Date;
  to?: Date;
  /**
   * Restricts the search to one tenant. Only ever set by the master-admin
   * cross-tenant caller (`modules/master-admin/service/master-admin-audit.service.ts`),
   * which also passes `{ ignoreTenant: true }` in `options` so `BaseRepository`'s
   * mandatory tenant guard doesn't fire — see that guard's comment on
   * `RepositoryOptions.ignoreTenant`. The tenant-scoped `AuditLogService` never
   * sets this; it relies entirely on `options.tenantId` instead, exactly as
   * before this field existed.
   */
  tenantId?: string;
}

export interface RecordAuditLogInput {
  eventType: AuditEventType;
  actorId: string;
  actorName: string;
  targetType?: string | null;
  targetId?: string | null;
  description: string;
  ipAddress?: string | null;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Audit Log Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Data access for `AuditLog`. Inherits tenant scoping from `BaseRepository`,
 * but the model has no `deletedAt` column (compliance records are never
 * soft-deleted — see `schema.prisma`'s Section 17 header comment), so every
 * method here passes `ignoreSoftDelete: true`, the same fix `PlatformInvoice
 * Repository.paginateWithPlan()` needed for the same reason.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class AuditLogRepository extends BaseRepository<Prisma.AuditLogDelegate, AuditLog> {
  constructor(prisma: PrismaClient) {
    super(prisma.auditLog, prisma);
  }

  async search(
    filters: AuditLogSearchFilters,
    pagination: PaginationQuery,
    options: RepositoryOptions = {},
  ): Promise<{ data: AuditLog[]; meta: PaginationMeta }> {
    const where: Prisma.AuditLogWhereInput = {};

    if (filters.tenantId) {
      where.tenantId = filters.tenantId;
    }
    if (filters.eventType) {
      where.eventType = filters.eventType;
    }
    if (filters.actorId) {
      where.actorId = filters.actorId;
    }
    if (filters.targetType) {
      where.targetType = filters.targetType;
    }
    if (filters.targetId) {
      where.targetId = filters.targetId;
    }
    if (filters.from || filters.to) {
      where.createdAt = { gte: filters.from, lte: filters.to };
    }
    if (filters.search) {
      where.description = { contains: filters.search, mode: 'insensitive' };
    }

    return this.paginate(pagination, where, { ...options, ignoreSoftDelete: true });
  }

  async findByIdScoped(id: string, options: RepositoryOptions = {}): Promise<AuditLog | null> {
    return this.findById(id, { ...options, ignoreSoftDelete: true });
  }

  /** Best-effort observability write, called from other modules via `AuditLogRecorder`. */
  async record(input: RecordAuditLogInput, options: RepositoryOptions): Promise<AuditLog> {
    return this.create(
      {
        eventType: input.eventType,
        actorId: input.actorId,
        actorName: input.actorName,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        description: input.description,
        ipAddress: input.ipAddress ?? null,
      },
      options,
    );
  }
}
