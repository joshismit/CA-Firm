import { Worker, Job } from 'bullmq';
import { redis } from '@config/redis';
import { logger } from '@config/logger';
import { QUEUE_NAMES, integrationSyncScanQueue } from '@config/queue';
import { INTEGRATION_SYNC_SCAN } from '@shared/constants';
import { prisma } from '@config/database';
import { IntegrationSyncEngine } from '@modules/integrations/service/integration-sync-engine.service';
import { IntegrationConnectionRepository, IntegrationJobRepository } from '@modules/integrations/repository';

interface IntegrationSyncJobData {
  syncId: string;
}

type IntegrationSyncScanJobData = Record<string, never>;

const syncEngine = new IntegrationSyncEngine();
const jobRepository = new IntegrationJobRepository(prisma);

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Integration Sync Worker (PRD §17 Step 6 — generic sync framework)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Consumes `QUEUE_NAMES.INTEGRATION_SYNC` — every manual/scheduled/webhook-triggered
 * sync run alike, all created via `IntegrationSyncEngine.trigger*()`. A thin
 * adapter, same division of responsibility as `task-reminder.worker.ts`: all
 * the actual provider-resolution/result-interpretation logic lives in
 * `IntegrationSyncEngine.executeSync()`, unit-tested on its own. Throwing here
 * lets BullMQ's own `attempts`/`backoff` (`integrationSyncQueue`'s options,
 * `config/queue.ts`) retry a run that failed for an infrastructure reason
 * (DB hiccup, etc.) — a run that completed but the PROVIDER reported failures
 * for is not re-thrown, `executeSync()` already recorded that as a `FAILED`/
 * `PARTIAL_SUCCESS` `IntegrationSync` row, which is a successful job as far
 * as BullMQ is concerned.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function createIntegrationSyncWorker(): Worker<IntegrationSyncJobData> {
  return new Worker<IntegrationSyncJobData>(
    QUEUE_NAMES.INTEGRATION_SYNC,
    async (job: Job<IntegrationSyncJobData>) => {
      const jobRow = await jobRepository.findByQueueJobId(job.data.syncId);
      if (jobRow) await jobRepository.markRunning(jobRow.id);
      await syncEngine.executeSync(job.data.syncId);
      if (jobRow) await jobRepository.markCompleted(jobRow.id);
    },
    { connection: redis },
  );
}

/**
 * Consumes `QUEUE_NAMES.INTEGRATION_SYNC_SCAN` — the repeatable scan itself.
 * Enqueues at most `IntegrationConnectionRepository.findDueForScheduledSync()`'s
 * page of connections per tick; a connection with more due than fit in one
 * page is simply picked up on the next tick (5 minutes later), never lost.
 */
export function createIntegrationSyncScanWorker(): Worker<IntegrationSyncScanJobData> {
  const connectionRepository = new IntegrationConnectionRepository(prisma);
  return new Worker<IntegrationSyncScanJobData>(
    QUEUE_NAMES.INTEGRATION_SYNC_SCAN,
    async () => {
      const due = await connectionRepository.findDueForScheduledSync(new Date());
      let enqueued = 0;
      for (const connection of due) {
        const sync = await syncEngine.triggerScheduled(connection);
        if (sync) enqueued += 1;
      }
      return { scanned: due.length, enqueued };
    },
    { connection: redis },
  );
}

/** Idempotent — same reasoning as `scheduleTaskReminderJob()`, safe to call on every worker boot. */
export async function scheduleIntegrationSyncScanJob(): Promise<void> {
  await integrationSyncScanQueue.add(
    INTEGRATION_SYNC_SCAN.JOB_NAME,
    {},
    { repeat: { pattern: INTEGRATION_SYNC_SCAN.CRON_SCHEDULE }, jobId: INTEGRATION_SYNC_SCAN.JOB_NAME },
  );
  logger.info({ cron: INTEGRATION_SYNC_SCAN.CRON_SCHEDULE }, 'Integration sync scan scheduled');
}

/**
 * Registered by `workers/index.ts` on the sync worker's `'failed'` event —
 * once `job.attemptsMade` reaches `integrationSyncQueue`'s configured
 * `attempts`, marks the durable `IntegrationJob` row `DEAD_LETTER` (PRD §17
 * Step 7) instead of leaving it `RETRYING` forever. A job with retries
 * remaining is left alone; BullMQ will re-run it.
 */
export async function handleIntegrationSyncJobExhausted(job: Job<IntegrationSyncJobData> | undefined, err: Error): Promise<void> {
  if (!job) return;
  const attempts = job.opts.attempts ?? 1;
  const jobRow = await jobRepository.findByQueueJobId(job.data.syncId);
  if (!jobRow) return;
  await jobRepository.markFailed(jobRow.id, err.message, job.attemptsMade >= attempts);
}
