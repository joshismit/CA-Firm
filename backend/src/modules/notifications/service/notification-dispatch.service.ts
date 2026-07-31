import { Notification, NotificationChannel, NotificationStatus } from '@prisma/client';
import { prisma } from '@config/database';
import { notificationQueue } from '@config/queue';
import { NotificationRepository } from '../repository/notification.repository';

export interface SendNotificationInput {
  tenantId: string;
  userId: string;
  title: string;
  message: string;
  /** Every channel the caller wants this notification delivered through. `IN_APP` is typical alongside at least one external channel, but neither is required by the other. */
  channels: NotificationChannel[];
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Notification Dispatch Service (PRD §11 — WhatsApp/Email/SMS delivery)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The one entry point other modules will call to notify a user across one or
 * more channels — not yet wired into any business event (see this feature's
 * scope note: delivery engine first, trigger wiring later), but built the
 * same way `AuditLogRecorder` is: explicit constructor DI, explicit params,
 * no `BaseService`/request coupling, so a future caller can compose it
 * exactly like any other cross-module dependency.
 *
 * `IN_APP` never touches the queue — it's a plain DB row with nothing to
 * "deliver" (the row appearing IS the delivery), so it's created directly
 * with `status: SENT`. Every other channel is created `PENDING` and handed
 * to `notificationQueue`; `workers/notification.worker.ts` is what actually
 * calls the channel's `NotificationProvider` and resolves the row to
 * `SENT`/`FAILED`. One `Notification` row per channel (not one row with a
 * channel list) — matches the existing schema exactly (`channel` is a single
 * enum column, not an array).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class NotificationDispatchService {
  constructor(private readonly repository: NotificationRepository = new NotificationRepository(prisma)) {}

  async send(input: SendNotificationInput): Promise<Notification[]> {
    const created: Notification[] = [];

    for (const channel of input.channels) {
      const isInApp = channel === NotificationChannel.IN_APP;

      // eslint-disable-next-line no-await-in-loop -- small, bounded (at most 4 channels) sequential writes.
      const notification = await this.repository.create(
        {
          userId: input.userId,
          channel,
          title: input.title,
          message: input.message,
          status: isInApp ? NotificationStatus.SENT : NotificationStatus.PENDING,
        },
        { tenantId: input.tenantId },
      );

      if (!isInApp) {
        // eslint-disable-next-line no-await-in-loop -- see above.
        await notificationQueue.add('deliver', { notificationId: notification.id });
      }

      created.push(notification);
    }

    return created;
  }
}
