import { NotificationStatus } from '@prisma/client';
import { prisma } from '@config/database';
import { NotificationRepository } from '../repository/notification.repository';

export interface NotificationDashboardWidgets {
  /** User-scoped — the caller's own unread count, not tenant-wide. */
  unreadCount: number;
  /** Tenant-wide — every reminder (Task/Billing/Compliance/Document) actually sent today, summed across all four idempotency ledgers. */
  todaysReminders: number;
  /** Tenant-wide — `Notification` rows still `PENDING` with a future `scheduledFor` (scheduled deliveries not yet due). */
  upcomingReminders: number;
  /** Tenant-wide — `Notification` rows that ended `FAILED` in the last 7 days. */
  failedNotifications: number;
  /** Tenant-wide — the most recent notifications across every user, newest first. */
  recentActivity: Array<{ id: string; title: string; channel: string; status: string; createdAt: string }>;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Notification Dashboard Reader (PRD §11.14)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Mirrors `ComplianceDashboardReader`'s "standalone class, one method, flat
 * DTO" shape exactly. Widget scope is deliberately mixed: `unreadCount` is
 * the CALLER's own (personal inbox concern), the other four are tenant-wide
 * (admin concern) — each documented per-field above rather than picking one
 * scope and forcing every widget into it.
 *
 * "Today's reminders" counts across all four reminder idempotency ledgers
 * (`TaskReminder`/`InvoiceReminder`/`ComplianceReminder`/`DocumentRequestReminder`)
 * rather than re-deriving it from `AuditLog` text — those tables are the
 * actual source of truth for "a reminder was sent," the audit rows are a
 * secondary record of the same fact.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class NotificationDashboardReader {
  constructor(private readonly repository: NotificationRepository = new NotificationRepository(prisma)) {}

  async getWidgets(tenantId: string, userId: string, now: Date = new Date()): Promise<NotificationDashboardWidgets> {
    const todayStart = startOfUtcDay(now);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [unreadCount, todaysReminderCounts, upcomingReminders, failedNotifications, recentActivity] = await Promise.all([
      this.repository.count({ isRead: false, userId }, { tenantId }),
      Promise.all([
        prisma.taskReminder.count({ where: { tenantId, sentAt: { gte: todayStart } } }),
        prisma.invoiceReminder.count({ where: { tenantId, sentAt: { gte: todayStart } } }),
        prisma.complianceReminder.count({ where: { tenantId, sentAt: { gte: todayStart } } }),
        prisma.documentRequestReminder.count({ where: { tenantId, sentAt: { gte: todayStart } } }),
      ]),
      prisma.notification.count({ where: { tenantId, status: NotificationStatus.PENDING, scheduledFor: { gt: now } } }),
      prisma.notification.count({ where: { tenantId, status: NotificationStatus.FAILED, createdAt: { gte: sevenDaysAgo } } }),
      prisma.notification.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, title: true, channel: true, status: true, createdAt: true },
      }),
    ]);

    return {
      unreadCount,
      todaysReminders: todaysReminderCounts.reduce((sum, count) => sum + count, 0),
      upcomingReminders,
      failedNotifications,
      recentActivity: recentActivity.map((row) => ({
        id: row.id,
        title: row.title,
        channel: row.channel,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }
}
