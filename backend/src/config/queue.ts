import { Queue } from 'bullmq';
import { redis } from './redis';

/**
 * BullMQ connection options.
 * Reuses the IORedis singleton connection.
 */
const connection = redis;

/**
 * Queue Names — centralized to avoid magic strings.
 */
export const QUEUE_NAMES = {
  EMAIL: 'email',
  NOTIFICATION: 'notification',
  REPORT: 'report',
  AUDIT: 'audit',
  DOCUMENT_PROCESSING: 'document-processing',
  TASK_REMINDER: 'task-reminder',
  BILLING_REMINDER: 'billing-reminder',
  COMPLIANCE_REMINDER: 'compliance-reminder',
  DOCUMENT_REMINDER: 'document-reminder',
  INTEGRATION_SYNC: 'integration-sync',
  INTEGRATION_WEBHOOK: 'integration-webhook',
  INTEGRATION_SYNC_SCAN: 'integration-sync-scan',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/**
 * BullMQ Queue instances.
 * Workers connect to these queues from workers/index.ts
 */
export const emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

export const notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATION, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

export const reportQueue = new Queue(QUEUE_NAMES.REPORT, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 10000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
});

export const auditQueue = new Queue(QUEUE_NAMES.AUDIT, {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 1000 },
  },
});

export const documentProcessingQueue = new Queue(QUEUE_NAMES.DOCUMENT_PROCESSING, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 15000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
});

/**
 * The one repeatable-job queue in this codebase (every other queue above is
 * enqueued per business event). `workers/task-reminder.worker.ts` schedules
 * its single recurring job onto this queue at worker-process startup — see
 * `scheduleTaskReminderJob()` there.
 */
export const taskReminderQueue = new Queue(QUEUE_NAMES.TASK_REMINDER, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 30000 },
    removeOnComplete: { count: 30 },
    removeOnFail: { count: 30 },
  },
});

/** PRD §11.12 — same repeatable-job shape as `taskReminderQueue` above, one queue per reminder domain (Billing/Compliance/Document) so each scan's schedule/backoff/history is independent. */
export const billingReminderQueue = new Queue(QUEUE_NAMES.BILLING_REMINDER, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 30000 },
    removeOnComplete: { count: 30 },
    removeOnFail: { count: 30 },
  },
});

export const complianceReminderQueue = new Queue(QUEUE_NAMES.COMPLIANCE_REMINDER, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 30000 },
    removeOnComplete: { count: 30 },
    removeOnFail: { count: 30 },
  },
});

export const documentReminderQueue = new Queue(QUEUE_NAMES.DOCUMENT_REMINDER, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 30000 },
    removeOnComplete: { count: 30 },
    removeOnFail: { count: 30 },
  },
});

/**
 * PRD §17 — Integration Framework. `IntegrationSyncEngine` enqueues every sync
 * run here (manual, scheduled, and webhook-triggered alike) rather than ever
 * running a provider's `sync()` inline on the request/cron path — retries/backoff
 * are handled entirely by BullMQ, no provider-specific retry logic.
 */
export const integrationSyncQueue = new Queue(QUEUE_NAMES.INTEGRATION_SYNC, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

/**
 * PRD §17 Step 7 — the generic webhook framework's retry/dead-letter queue.
 * `IntegrationWebhookController` only ever logs the inbound call and enqueues
 * it here; `workers/integration-webhook.worker.ts` does the actual provider
 * lookup + processing, so a slow/failing provider call never blocks the
 * webhook response back to the third party.
 */
export const integrationWebhookQueue = new Queue(QUEUE_NAMES.INTEGRATION_WEBHOOK, {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  },
});

/**
 * The repeatable-job trigger for the scheduled-sync scan (`INTEGRATION_SYNC_SCAN.CRON_SCHEDULE`,
 * `workers/integration-sync.worker.ts`'s `scheduleIntegrationSyncScanJob()`) — deliberately a
 * SEPARATE queue from `integrationSyncQueue` above, same "one queue per scan trigger" shape as
 * `taskReminderQueue`/`billingReminderQueue`/etc. The scan itself does no provider work; it only
 * enqueues one `integrationSyncQueue` job per due connection.
 */
export const integrationSyncScanQueue = new Queue(QUEUE_NAMES.INTEGRATION_SYNC_SCAN, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 30000 },
    removeOnComplete: { count: 30 },
    removeOnFail: { count: 30 },
  },
});
