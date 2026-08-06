import { PrismaClient, Prisma, NotificationTemplate, NotificationChannel } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';
import { PaginationQuery, PaginationMeta } from '@shared/types';

export interface NotificationTemplateSearchFilters {
  channel?: NotificationChannel;
  isActive?: boolean;
  /** Matches against `name`/`key` (case-insensitive). */
  search?: string;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Notification Template Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Data access for `NotificationTemplate`. Two lookup shapes exist side by
 * side because `tenantId` is nullable and means something different on each
 * row: a normal tenant-scoped query (via `BaseRepository`'s inherited
 * methods, `options.tenantId` set) only ever sees that tenant's own
 * override/custom rows, while `findGlobalByKeyAndChannel`/
 * `findGlobalDefaults` deliberately pass `ignoreTenant: true` to reach the
 * `tenantId IS NULL` system-default rows every tenant falls back to — the
 * one place in this module allowed to bypass tenant scoping, mirroring
 * `BusinessAssignmentRepository`'s own precedent for a deliberate escape
 * hatch.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class NotificationTemplateRepository extends BaseRepository<Prisma.NotificationTemplateDelegate, NotificationTemplate> {
  constructor(prisma: PrismaClient) {
    super(prisma.notificationTemplate, prisma);
  }

  async search(
    filters: NotificationTemplateSearchFilters,
    pagination: PaginationQuery,
    options: RepositoryOptions = {},
  ): Promise<{ data: NotificationTemplate[]; meta: PaginationMeta }> {
    const where: Prisma.NotificationTemplateWhereInput = {};

    if (filters.channel) where.channel = filters.channel;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { key: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.paginate(pagination, where, options);
  }

  /** This tenant's own override/custom row for `(key, channel)`, if any. */
  async findByKeyAndChannel(
    key: string,
    channel: NotificationChannel,
    options: RepositoryOptions = {},
  ): Promise<NotificationTemplate | null> {
    return this.findFirst({ key, channel }, options);
  }

  /** The global system-default row for `(key, channel)` — bypasses tenant scoping deliberately, see this class's header comment. */
  async findGlobalByKeyAndChannel(key: string, channel: NotificationChannel): Promise<NotificationTemplate | null> {
    return this.findFirst({ key, channel, tenantId: null }, { ignoreTenant: true });
  }

  /** Every global system-default row — the fallback catalog every tenant starts from. */
  async findGlobalDefaults(): Promise<NotificationTemplate[]> {
    return this.findMany({ tenantId: null }, { ignoreTenant: true }, undefined, { key: 'asc' });
  }
}
