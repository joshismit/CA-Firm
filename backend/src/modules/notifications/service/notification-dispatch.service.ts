import { Notification, NotificationChannel, NotificationStatus, NotificationPriority, AuditEventType } from '@prisma/client';
import { prisma } from '@config/database';
import { notificationQueue } from '@config/queue';
import { AUDIT } from '@shared/constants';
// Concrete path, not the `@modules/audit` barrel — that barrel also loads `audit-log.routes.ts`,
// which imports `tenantMiddleware`; `tenant.middleware.ts` itself imports this file via ITS OWN
// concrete path specifically to avoid a module-load cycle (see that file's header comment), and
// an audit-barrel import here would silently reopen the same cycle through a different edge.
import { AuditLogRecorder } from '@modules/audit/service/audit-log.recorder';
import { NotificationRepository } from '../repository/notification.repository';
import { NotificationPreferenceResolver } from './notification-preference-resolver';
import { NotificationTemplateRenderer } from './notification-template-renderer';

export interface SendNotificationInput {
  tenantId: string;
  userId: string;
  title: string;
  message: string;
  /** Every channel the caller wants this notification delivered through. `IN_APP` is typical alongside at least one external channel, but neither is required by the other. */
  channels: NotificationChannel[];
  /** Who to attribute the resulting `NOTIFICATION_CREATED` audit event(s) to. Defaults to `AUDIT.SYSTEM_ACTOR_ID` — most callers are system/business-logic triggers (task reminders, assignment changes, ...), not a request with a real acting user in hand. `POST /notifications/send` passes the calling admin's own id here. */
  actorId?: string;
  priority?: NotificationPriority;
  /** PRD §11.10 "Scheduled delivery" — delays the BullMQ job by this much. `IN_APP` ignores it (see this file's header comment — it always fires immediately, there's nothing to schedule). */
  scheduledFor?: Date;
  /** PRD §11.10 "Duplicate prevention" — if a non-terminal (PENDING/SENT) notification with this same `(tenantId, userId, channel, dedupeKey)` was created within the last 24h, that existing row is returned instead of creating a new one. */
  dedupeKey?: string;
  /** When set, renders `title`/`message` from the named `NotificationTemplate` via `NotificationTemplateRenderer` instead of using the literal strings above. */
  templateKey?: string;
  templateContext?: Record<string, unknown>;
}

const BULLMQ_PRIORITY_BY_LEVEL: Record<NotificationPriority, number> = {
  [NotificationPriority.URGENT]: 1,
  [NotificationPriority.HIGH]: 2,
  [NotificationPriority.NORMAL]: 3,
  [NotificationPriority.LOW]: 4,
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Notification Dispatch Service (PRD §11 — WhatsApp/Email/SMS delivery)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The one entry point other modules call to notify a user across one or
 * more channels — built the same way `AuditLogRecorder` is: explicit
 * constructor DI, explicit params, no `BaseService`/request coupling, so a
 * caller can compose it exactly like any other cross-module dependency.
 *
 * `IN_APP` never touches the queue, is never preference-filtered (a
 * security-relevant system notice — e.g. an account lock — must never be
 * silently suppressible by the affected user's own preference row), and
 * ignores `scheduledFor` — it's a plain DB row with nothing to "deliver"
 * (the row appearing IS the delivery), so it's created directly with
 * `status: SENT`. Every other channel goes through
 * `NotificationPreferenceResolver` first (firm kill-switch → user channel
 * toggle → mute → quiet hours, the last of which reschedules rather than
 * drops), then is created `PENDING` and handed to `notificationQueue` with
 * `jobId: notification.id` (1:1, so `cancel()` can remove it by that same
 * id), an optional `delay`, and a priority. `workers/notification.worker.ts`
 * is what actually calls the channel's `NotificationProvider` and resolves
 * the row to `SENT`/`FAILED`. One `Notification` row per channel (not one
 * row with a channel list) — matches the schema exactly (`channel` is a
 * single enum column, not an array).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class NotificationDispatchService {
  constructor(
    private readonly repository: NotificationRepository = new NotificationRepository(prisma),
    private readonly preferenceResolver: NotificationPreferenceResolver = new NotificationPreferenceResolver(),
    private readonly templateRenderer: NotificationTemplateRenderer = new NotificationTemplateRenderer(),
    private readonly auditLogRecorder: AuditLogRecorder = new AuditLogRecorder(),
  ) {}

  async send(input: SendNotificationInput): Promise<Notification[]> {
    const created: Notification[] = [];
    const priority = input.priority ?? NotificationPriority.NORMAL;
    const actorId = input.actorId ?? AUDIT.SYSTEM_ACTOR_ID;
    // Only override the resolved name for the system sentinel — a real caller-supplied actorId
    // should resolve to that user's real name, exactly like every other `AuditLogRecorder.record()` caller.
    const actorName = input.actorId ? undefined : AUDIT.SYSTEM_ACTOR_NAME;

    for (const channel of input.channels) {
      const isInApp = channel === NotificationChannel.IN_APP;

      if (!isInApp && input.dedupeKey) {
        // eslint-disable-next-line no-await-in-loop -- small, bounded (at most 4 channels) sequential checks.
        const existing = await this.repository.findRecentByDedupeKey(input.userId, channel, input.dedupeKey, {
          tenantId: input.tenantId,
        });
        if (existing) {
          created.push(existing);
          continue;
        }
      }

      let scheduledFor = input.scheduledFor;
      if (!isInApp) {
        // eslint-disable-next-line no-await-in-loop -- see above.
        const decision = await this.preferenceResolver.resolve(input.tenantId, input.userId, channel);
        if (!decision.allowed) {
          if (!decision.rescheduleFor) continue; // firm kill-switch / user preference off / muted — skip this channel entirely
          scheduledFor = decision.rescheduleFor; // quiet hours — reschedule instead of dropping
        }
      }

      let title = input.title;
      let message = input.message;
      if (input.templateKey) {
        // eslint-disable-next-line no-await-in-loop -- see above.
        const rendered = await this.templateRenderer.render(input.tenantId, input.templateKey, channel, input.templateContext ?? {});
        title = rendered.subject ?? title;
        message = rendered.bodyText;
      }

      // eslint-disable-next-line no-await-in-loop -- see above.
      const notification = await this.repository.create(
        {
          userId: input.userId,
          channel,
          title,
          message,
          status: isInApp ? NotificationStatus.SENT : NotificationStatus.PENDING,
          priority,
          scheduledFor: isInApp ? null : scheduledFor ?? null,
          dedupeKey: input.dedupeKey ?? null,
          sentAt: isInApp ? new Date() : null,
        },
        { tenantId: input.tenantId },
      );

      if (!isInApp) {
        const delay = scheduledFor ? Math.max(0, scheduledFor.getTime() - Date.now()) : undefined;
        // eslint-disable-next-line no-await-in-loop -- see above.
        await notificationQueue.add(
          'deliver',
          { notificationId: notification.id },
          { jobId: notification.id, delay, priority: BULLMQ_PRIORITY_BY_LEVEL[priority] },
        );
      }

      // Best-effort — never blocks/fails the send itself, see AuditLogRecorder's own header comment.
      // eslint-disable-next-line no-await-in-loop -- see above.
      await this.auditLogRecorder.record({
        tenantId: input.tenantId,
        actorId,
        actorName,
        eventType: AuditEventType.NOTIFICATION_CREATED,
        description: `Notification "${title}" queued on channel ${channel}`,
        targetType: 'Notification',
        targetId: notification.id,
      });

      created.push(notification);
    }

    return created;
  }

  /**
   * PRD §11.10 "Cancellation" — only reachable from `PENDING` (a `SENT`/`FAILED`/already-
   * `CANCELLED` notification has nothing left to cancel). Removes the BullMQ job by the same
   * `jobId` it was enqueued with, so a cancelled notification is guaranteed to never be
   * delivered by a race with the worker picking it up moments later — `job.remove()` is a no-op
   * (not an error) if the worker already claimed it, in which case `status` simply won't be
   * `PENDING` anymore by the time this runs and the whole call returns `false`.
   */
  async cancel(notificationId: string, options: { tenantId: string; actorId?: string }): Promise<boolean> {
    const notification = await this.repository.findById(notificationId, { tenantId: options.tenantId });
    if (!notification || notification.status !== NotificationStatus.PENDING) return false;

    const job = await notificationQueue.getJob(notificationId);
    await job?.remove();

    await this.repository.update(
      notificationId,
      { status: NotificationStatus.CANCELLED, cancelledAt: new Date() },
      { tenantId: options.tenantId },
    );

    await this.auditLogRecorder.record({
      tenantId: options.tenantId,
      actorId: options.actorId ?? AUDIT.SYSTEM_ACTOR_ID,
      actorName: options.actorId ? undefined : AUDIT.SYSTEM_ACTOR_NAME,
      eventType: AuditEventType.NOTIFICATION_CANCELLED,
      description: `Cancelled notification "${notification.title}"`,
      targetType: 'Notification',
      targetId: notificationId,
    });

    return true;
  }
}
