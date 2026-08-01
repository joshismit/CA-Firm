import process from 'process';

try {
  process.loadEnvFile();
} catch (e) {
  // Ignore if .env doesn't exist
}

import { logger } from '@config/logger';
import { createEmailWorker } from './email.worker';
import { createNotificationWorker } from './notification.worker';

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

emailWorker.on('completed', (job) => logger.info({ jobId: job.id }, 'Email job completed'));
emailWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'Email job failed'));
notificationWorker.on('completed', (job) => logger.info({ jobId: job.id }, 'Notification delivery job completed'));
notificationWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'Notification delivery job failed'));

logger.info('Worker process started — listening on "email" and "notification" queues');

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Worker process shutting down');
  await Promise.all([emailWorker.close(), notificationWorker.close()]);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
