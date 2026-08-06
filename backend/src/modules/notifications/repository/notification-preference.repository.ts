import { PrismaClient, NotificationPreference } from '@prisma/client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Notification Preference Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Deliberately does NOT extend `BaseRepository` — `NotificationPreference` is
 * a one-row-per-user singleton (`userId` is `@unique`), so every real
 * operation is "find/create-or-update the one row for this user," not the
 * find-by-id/paginate shape `BaseRepository` is built around. Mirrors
 * `modules/dashboard/repository/dashboard-preference.repository.ts`'s
 * identical reasoning. Looked up by `userId` alone — a `User.id` is already
 * scoped to exactly one tenant, so no separate `tenantId` filter is needed.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class NotificationPreferenceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByUserId(userId: string): Promise<NotificationPreference | null> {
    return this.prisma.notificationPreference.findUnique({ where: { userId } });
  }

  async upsert(
    tenantId: string,
    userId: string,
    data: Partial<
      Pick<
        NotificationPreference,
        'emailEnabled' | 'smsEnabled' | 'whatsappEnabled' | 'digestFrequency' | 'quietHoursStart' | 'quietHoursEnd' | 'muteUntil'
      >
    >,
  ): Promise<NotificationPreference> {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { tenantId, userId, ...data },
      update: data,
    });
  }

  /** Bulk-fetched by `NotificationPreferenceResolver` — one query per dispatch batch, not one per recipient. */
  async findByUserIds(userIds: string[]): Promise<NotificationPreference[]> {
    if (userIds.length === 0) return [];
    return this.prisma.notificationPreference.findMany({ where: { userId: { in: userIds } } });
  }
}
