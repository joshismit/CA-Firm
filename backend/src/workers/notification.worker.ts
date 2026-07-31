import { Worker, Job } from 'bullmq';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { prisma } from '@config/database';
import { redis } from '@config/redis';
import { logger } from '@config/logger';
import { QUEUE_NAMES } from '@config/queue';
import { resolveProvider } from '@modules/notifications/providers';

interface DeliverNotificationJobData {
  notificationId: string;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Notification Delivery Worker
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Consumes `QUEUE_NAMES.NOTIFICATION`, the queue `NotificationDispatchService`
 * enqueues onto for every non-`IN_APP` channel. Looks the `Notification` row
 * back up (rather than carrying its full contents in the job payload) so the
 * DB stays the single source of truth if the row changes between enqueue and
 * processing — the job is just a pointer.
 *
 * A missing row or a `NotificationProvider` reporting failure both resolve
 * the job successfully (no throw, no retry) — a permanently-unconfigured
 * WhatsApp/SMS provider would otherwise retry 3 times (per
 * `config/queue.ts`'s `notificationQueue` options) for a failure that will
 * never change. `Notification.status` already carries the outcome; that's
 * the durable record, not the job's own state.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function createNotificationWorker(): Worker<DeliverNotificationJobData> {
  return new Worker<DeliverNotificationJobData>(
    QUEUE_NAMES.NOTIFICATION,
    async (job: Job<DeliverNotificationJobData>) => {
      const notification = await prisma.notification.findUnique({
        where: { id: job.data.notificationId },
        include: { user: true },
      });

      if (!notification) {
        logger.warn({ notificationId: job.data.notificationId }, 'Notification row not found — skipping delivery');
        return;
      }

      if (notification.channel === NotificationChannel.IN_APP) {
        // Should never actually be enqueued (see NotificationDispatchService), but if it is,
        // there's nothing to deliver — the row itself is the delivery.
        return;
      }

      const recipient = notification.channel === NotificationChannel.EMAIL ? notification.user.email : notification.user.phone;

      if (!recipient) {
        await prisma.notification.update({
          where: { id: notification.id },
          data: { status: NotificationStatus.FAILED },
        });
        logger.warn(
          { notificationId: notification.id, channel: notification.channel },
          `User has no ${notification.channel === NotificationChannel.EMAIL ? 'email' : 'phone'} on file`,
        );
        return;
      }

      const provider = resolveProvider(notification.channel);
      const result = await provider.send({ to: recipient, subject: notification.title, message: notification.message });

      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: result.success ? NotificationStatus.SENT : NotificationStatus.FAILED },
      });

      if (!result.success) {
        logger.warn({ notificationId: notification.id, channel: notification.channel, error: result.error }, 'Notification delivery failed');
      }
    },
    { connection: redis },
  );
}
