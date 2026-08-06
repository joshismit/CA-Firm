import { Worker, Job } from 'bullmq';
import { NotificationChannel, NotificationStatus, AuditEventType } from '@prisma/client';
import { prisma } from '@config/database';
import { redis } from '@config/redis';
import { logger } from '@config/logger';
import { QUEUE_NAMES } from '@config/queue';
import { AUDIT } from '@shared/constants';
// Concrete path — see `modules/notifications/service/notification-dispatch.service.ts`'s identical comment for why.
import { AuditLogRecorder } from '@modules/audit/service/audit-log.recorder';
import { resolveProvider } from '@modules/notifications/providers';

interface DeliverNotificationJobData {
  notificationId: string;
}

const auditLogRecorder = new AuditLogRecorder();

/** A caught delivery failure — thrown so BullMQ's own `attempts`/`backoff` (see `config/queue.ts`'s `notificationQueue` options) actually retries. Distinguished from a genuinely permanent failure (missing recipient, unconfigured provider), which resolves the job successfully instead — see this file's header comment. */
class RetryableDeliveryError extends Error {}

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
 * Two different kinds of failure are handled differently:
 *   - PERMANENT (missing row, missing recipient contact info, unconfigured
 *     provider) — resolves the job successfully (no throw, no retry). A
 *     permanently-unconfigured WhatsApp/SMS provider would otherwise retry
 *     3 times (per `notificationQueue`'s options) for a failure that will
 *     never change.
 *   - RETRYABLE (a configured provider's `send()` call itself failed —
 *     transient network/vendor error) — increments `retryCount`, writes
 *     `NOTIFICATION_RETRIED`, and re-throws `RetryableDeliveryError` so
 *     BullMQ's own backoff actually retries. The `'failed'` listener
 *     registered by `workers/index.ts` on this worker only flips the row to
 *     `FAILED`/writes `NOTIFICATION_FAILED` once `job.attemptsMade` reaches
 *     the queue's configured `attempts` — a mid-retry job stays `PENDING`.
 *     The queue's own failed-job set (`removeOnFail: {count: 500}`) IS the
 *     dead-letter queue; no separate DLQ infrastructure is built here.
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

      // A notification cancelled after being enqueued but before this job ran (rare race with
      // `NotificationDispatchService.cancel()`, which removes the job by id — this only fires
      // if the job was already claimed by the time `cancel()` tried to remove it).
      if (notification.status !== NotificationStatus.PENDING) {
        logger.info({ notificationId: notification.id, status: notification.status }, 'Notification no longer pending — skipping delivery');
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

      if (!provider.isConfigured) {
        await prisma.notification.update({
          where: { id: notification.id },
          data: { status: NotificationStatus.FAILED, providerResponse: { reason: 'not configured' } },
        });
        await recordNotificationEvent(notification.tenantId, notification.id, AuditEventType.NOTIFICATION_FAILED, 'not configured');
        return;
      }

      const result = await provider.send({ to: recipient, subject: notification.title, message: notification.message });

      if (result.success) {
        await prisma.notification.update({
          where: { id: notification.id },
          data: {
            status: NotificationStatus.SENT,
            sentAt: new Date(),
            providerMessageId: result.providerMessageId ?? null,
          },
        });
        await recordNotificationEvent(notification.tenantId, notification.id, AuditEventType.NOTIFICATION_SENT, 'delivered');
        return;
      }

      const retryCount = await incrementRetryCount(notification.id, result.error);
      logger.warn(
        { notificationId: notification.id, channel: notification.channel, error: result.error, retryCount },
        'Notification delivery attempt failed',
      );
      if (retryCount > 1) {
        await recordNotificationEvent(notification.tenantId, notification.id, AuditEventType.NOTIFICATION_RETRIED, result.error ?? 'retry');
      }
      throw new RetryableDeliveryError(result.error ?? 'Notification delivery failed');
    },
    { connection: redis },
  );
}

async function incrementRetryCount(notificationId: string, error: string | undefined): Promise<number> {
  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { retryCount: { increment: 1 }, providerResponse: { error: error ?? 'Unknown error' } },
  });
  return updated.retryCount;
}

async function recordNotificationEvent(
  tenantId: string,
  notificationId: string,
  eventType: AuditEventType,
  detail: string,
): Promise<void> {
  await auditLogRecorder.record({
    tenantId,
    actorId: AUDIT.SYSTEM_ACTOR_ID,
    actorName: AUDIT.SYSTEM_ACTOR_NAME,
    eventType,
    description: `Notification ${notificationId}: ${detail}`,
    targetType: 'Notification',
    targetId: notificationId,
  });
}

/**
 * Registered by `workers/index.ts` on the `Worker` this file returns — only once
 * `job.attemptsMade` reaches the queue's configured `attempts` does a `RetryableDeliveryError`
 * actually mean "exhausted," at which point the row flips to `FAILED`. A job with retries
 * remaining stays `PENDING` (see this file's header comment) — this listener is what
 * distinguishes "will retry" from "gave up."
 */
export async function handleNotificationJobExhausted(job: Job<DeliverNotificationJobData> | undefined): Promise<void> {
  if (!job) return;
  const attempts = job.opts.attempts ?? 1;
  if (job.attemptsMade < attempts) return; // more retries remain — BullMQ will re-run this job

  const notification = await prisma.notification.findUnique({ where: { id: job.data.notificationId } });
  if (!notification || notification.status !== NotificationStatus.PENDING) return;

  await prisma.notification.update({ where: { id: notification.id }, data: { status: NotificationStatus.FAILED } });
  await recordNotificationEvent(notification.tenantId, notification.id, AuditEventType.NOTIFICATION_FAILED, 'retries exhausted');
}
