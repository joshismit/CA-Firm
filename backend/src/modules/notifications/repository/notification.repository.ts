import { PrismaClient, Prisma, Notification, NotificationChannel, NotificationStatus } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';
import { PaginationQuery, PaginationMeta } from '@shared/types';

export interface NotificationSearchFilters {
  /** Always required — every query is scoped to the caller's own notifications, not just their tenant. */
  userId: string;
  /** Matches against title or message (case-insensitive). */
  search?: string;
  channel?: NotificationChannel;
  status?: NotificationStatus;
  unreadOnly?: boolean;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Notification Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Data access for `Notification`. Inherits tenant scoping and standard
 * pagination from `BaseRepository`, but every method here ALSO takes
 * `userId` explicitly — `BaseRepository.applyFilters()` only knows about
 * `tenantId`/`deletedAt`, not a second "ownership" dimension, so ownership
 * scoping is added in each method's own `where` clause rather than in the
 * shared base class (which every other module's tenant-only entities still
 * rely on unchanged).
 *
 * `findByIdForUser`/`markAsRead`/`markAllAsRead`/`deleteForUser` are
 * bespoke methods (not overrides of `BaseRepository`'s `findById`/`delete`)
 * specifically because adding a required `userId` parameter to an
 * inherited method's signature would be a breaking, type-incompatible
 * override — mirrors the "bespoke method when the shape doesn't fit
 * BaseRepository" precedent used throughout this codebase (e.g.
 * `RoleRepository.userExistsInTenant`).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class NotificationRepository extends BaseRepository<Prisma.NotificationDelegate, Notification> {
  constructor(prisma: PrismaClient) {
    super(prisma.notification, prisma);
  }

  async search(
    filters: NotificationSearchFilters,
    pagination: PaginationQuery,
    options: RepositoryOptions = {},
  ): Promise<{ data: Notification[]; meta: PaginationMeta }> {
    const where: Prisma.NotificationWhereInput = { userId: filters.userId };

    if (filters.channel) {
      where.channel = filters.channel;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.unreadOnly) {
      where.isRead = false;
    }
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { message: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.paginate(pagination, where, options);
  }

  async findByIdForUser(id: string, userId: string, options: RepositoryOptions = {}): Promise<Notification | null> {
    return this.findFirst({ id, userId }, options);
  }

  /** Idempotent — marking an already-read notification as read is a no-op, not an error. Returns false only if no matching (id, tenant, owner) row exists at all. */
  async markAsRead(id: string, userId: string, options: RepositoryOptions = {}): Promise<boolean> {
    const where = this.applyFilters({ id, userId }, options);
    const client = this.getClient(options.tx);
    const result = (await client.updateMany({ where, data: { isRead: true } })) as { count: number };
    return result.count > 0;
  }

  /** Scoped to `(tenantId, userId)` only — must never affect another user's notifications, even within the same tenant. */
  async markAllAsRead(userId: string, options: RepositoryOptions = {}): Promise<number> {
    const where = this.applyFilters({ userId, isRead: false }, options);
    const client = this.getClient(options.tx);
    const result = (await client.updateMany({ where, data: { isRead: true } })) as { count: number };
    return result.count;
  }

  /** `Notification` has no `deletedBy` column — same reasoning as `ContactRepository`'s override, plus the ownership (`userId`) scoping this module adds throughout. */
  async deleteForUser(id: string, userId: string, options: RepositoryOptions = {}): Promise<boolean> {
    const where = this.applyFilters({ id, userId }, options);
    const client = this.getClient(options.tx);
    const result = (await client.updateMany({ where, data: { deletedAt: new Date() } })) as { count: number };
    return result.count > 0;
  }
}
