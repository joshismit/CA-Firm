import { PrismaClient, DashboardPreference, Prisma } from '@prisma/client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Dashboard Preference Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Deliberately does NOT extend `BaseRepository` — `DashboardPreference` is a
 * one-row-per-user singleton (`userId` is `@unique`, not just indexed), so
 * every real operation is "find/create-or-update the one row for this user,"
 * not the find-by-id/paginate shape `BaseRepository` is built around. Mirrors
 * `modules/tenant/repository/tenant-branding.repository.ts`'s identical
 * reasoning for the same kind of singleton relationship (there: one row per
 * tenant; here: one row per user).
 *
 * Looked up by `userId` alone, with no separate `tenantId` filter — a
 * `User.id` is already scoped to exactly one tenant, so there is no
 * cross-tenant row this lookup could accidentally return.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class DashboardPreferenceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByUserId(userId: string): Promise<DashboardPreference | null> {
    return this.prisma.dashboardPreference.findUnique({ where: { userId } });
  }

  /** Creates the row on first write, updates it on every write after — a user never has more than one. */
  async upsert(tenantId: string, userId: string, widgets: Prisma.InputJsonValue): Promise<DashboardPreference> {
    return this.prisma.dashboardPreference.upsert({
      where: { userId },
      create: { tenantId, userId, widgets },
      update: { widgets },
    });
  }
}
