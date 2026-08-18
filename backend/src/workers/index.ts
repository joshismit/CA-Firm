import process from 'process';

try {
  process.loadEnvFile();
} catch (e) {
  // Ignore if .env doesn't exist
}

import { logger } from '@config/logger';
import { createEmailWorker } from './email.worker';
import { createNotificationWorker, handleNotificationJobExhausted } from './notification.worker';
import { createTaskReminderWorker, scheduleTaskReminderJob } from './task-reminder.worker';
import { createBillingReminderWorker, scheduleBillingReminderJob } from './billing-reminder.worker';
import { createComplianceReminderWorker, scheduleComplianceReminderJob } from './compliance-reminder.worker';
import { createDocumentReminderWorker, scheduleDocumentReminderJob } from './document-reminder.worker';
import {
  createIntegrationSyncWorker,
  createIntegrationSyncScanWorker,
  scheduleIntegrationSyncScanJob,
  handleIntegrationSyncJobExhausted,
} from './integration-sync.worker';
import { createIntegrationWebhookWorker, handleIntegrationWebhookJobExhausted } from './integration-webhook.worker';

// Same rationale as src/server.ts — a worker mid-job that hits an unhandled
// error is in an unknown state; BullMQ's own retry/backoff picks the job back
// up on the next worker instance rather than this process limping onward.
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception in worker process — shutting down');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection in worker process — shutting down');
  process.exit(1);
});

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Worker Process Entry Point
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * A separate long-running process from the HTTP server (`src/server.ts`) —
 * `npm run worker`/`npm run worker:dev`, not started by `app.ts`/`server.ts`.
 * Standard BullMQ deployment split: the API process enqueues jobs and
 * returns immediately; this process is what actually calls out to SMTP/
 * WhatsApp/SMS, so a slow or down provider never blocks an HTTP response.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const emailWorker = createEmailWorker();
const notificationWorker = createNotificationWorker();
const taskReminderWorker = createTaskReminderWorker();
const billingReminderWorker = createBillingReminderWorker();
const complianceReminderWorker = createComplianceReminderWorker();
const documentReminderWorker = createDocumentReminderWorker();
const integrationSyncWorker = createIntegrationSyncWorker();
const integrationSyncScanWorker = createIntegrationSyncScanWorker();
const integrationWebhookWorker = createIntegrationWebhookWorker();

emailWorker.on('completed', (job) => logger.info({ jobId: job.id }, 'Email job completed'));
emailWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'Email job failed'));
notificationWorker.on('completed', (job) => logger.info({ jobId: job.id }, 'Notification delivery job completed'));
notificationWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Notification delivery job failed');
  handleNotificationJobExhausted(job).catch((handlerErr: unknown) => {
    logger.error({ handlerErr, jobId: job?.id }, 'Failed to handle exhausted notification job');
  });
});
taskReminderWorker.on('completed', (job) => logger.info({ jobId: job.id }, 'Task reminder scan completed'));
taskReminderWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'Task reminder scan failed'));
billingReminderWorker.on('completed', (job) => logger.info({ jobId: job.id }, 'Billing reminder scan completed'));
billingReminderWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'Billing reminder scan failed'));
complianceReminderWorker.on('completed', (job) => logger.info({ jobId: job.id }, 'Compliance reminder scan completed'));
complianceReminderWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'Compliance reminder scan failed'));
documentReminderWorker.on('completed', (job) => logger.info({ jobId: job.id }, 'Document reminder scan completed'));
documentReminderWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'Document reminder scan failed'));
integrationSyncWorker.on('completed', (job) => logger.info({ jobId: job.id }, 'Integration sync job completed'));
integrationSyncWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Integration sync job failed');
  handleIntegrationSyncJobExhausted(job, err).catch((handlerErr: unknown) => {
    logger.error({ handlerErr, jobId: job?.id }, 'Failed to handle exhausted integration sync job');
  });
});
integrationSyncScanWorker.on('completed', (job) => logger.info({ jobId: job.id, result: job.returnvalue }, 'Integration sync scan completed'));
integrationSyncScanWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'Integration sync scan failed'));
integrationWebhookWorker.on('completed', (job) => logger.info({ jobId: job.id }, 'Integration webhook job completed'));
integrationWebhookWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Integration webhook job failed');
  handleIntegrationWebhookJobExhausted(job, err).catch((handlerErr: unknown) => {
    logger.error({ handlerErr, jobId: job?.id }, 'Failed to handle exhausted integration webhook job');
  });
});

logger.info(
  'Worker process started — listening on "email", "notification", "task-reminder", "billing-reminder", "compliance-reminder", "document-reminder", "integration-sync", "integration-sync-scan", and "integration-webhook" queues',
);

// Idempotent (see scheduleTaskReminderJob's own comment) — safe to call on every boot.
scheduleTaskReminderJob().catch((err: unknown) => {
  logger.error({ err }, 'Failed to schedule task reminder job');
});
scheduleBillingReminderJob().catch((err: unknown) => {
  logger.error({ err }, 'Failed to schedule billing reminder job');
});
scheduleComplianceReminderJob().catch((err: unknown) => {
  logger.error({ err }, 'Failed to schedule compliance reminder job');
});
scheduleDocumentReminderJob().catch((err: unknown) => {
  logger.error({ err }, 'Failed to schedule document reminder job');
});
scheduleIntegrationSyncScanJob().catch((err: unknown) => {
  logger.error({ err }, 'Failed to schedule integration sync scan job');
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Worker process shutting down');
  await Promise.all([
    emailWorker.close(),
    notificationWorker.close(),
    taskReminderWorker.close(),
    billingReminderWorker.close(),
    complianceReminderWorker.close(),
    documentReminderWorker.close(),
    integrationSyncWorker.close(),
    integrationSyncScanWorker.close(),
    integrationWebhookWorker.close(),
  ]);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
