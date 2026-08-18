import { Worker, Job } from 'bullmq';
import { redis } from '@config/redis';
import { QUEUE_NAMES } from '@config/queue';
import { prisma } from '@config/database';
import { IntegrationSyncEngine } from '@modules/integrations/service/integration-sync-engine.service';
import { IntegrationWebhookLogRepository, IntegrationJobRepository } from '@modules/integrations/repository';

interface IntegrationWebhookJobData {
  webhookLogId: string;
}

const syncEngine = new IntegrationSyncEngine();
const webhookLogRepository = new IntegrationWebhookLogRepository(prisma);
const jobRepository = new IntegrationJobRepository(prisma);

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Integration Webhook Worker (PRD §17 Step 7 — generic webhook framework)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Consumes `QUEUE_NAMES.INTEGRATION_WEBHOOK` — every job
 * `IntegrationWebhookService.handleWebhook()` enqueues once a webhook has been
 * verified and logged. Turns that verified webhook into an `IntegrationSync`
 * run via `IntegrationSyncEngine.triggerWebhook()` (idempotent on
 * `webhookLogId`, see that method's own comment) and marks the log row
 * `PROCESSED`. A slow/failing provider call happens entirely off the original
 * webhook HTTP response, which already returned 200.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function createIntegrationWebhookWorker(): Worker<IntegrationWebhookJobData> {
  return new Worker<IntegrationWebhookJobData>(
    QUEUE_NAMES.INTEGRATION_WEBHOOK,
    async (job: Job<IntegrationWebhookJobData>) => {
      const jobRow = await jobRepository.findByQueueJobId(job.data.webhookLogId);
      if (jobRow) await jobRepository.markRunning(jobRow.id);

      const log = await webhookLogRepository.findById(job.data.webhookLogId);
      if (!log || !log.tenantId || !log.connectionId) {
        if (jobRow) await jobRepository.markCompleted(jobRow.id);
        return;
      }

      await syncEngine.triggerWebhook({ tenantId: log.tenantId, connectionId: log.connectionId, webhookLogId: log.id });
      await webhookLogRepository.markProcessed(log.id);
      if (jobRow) await jobRepository.markCompleted(jobRow.id);
    },
    { connection: redis },
  );
}

/**
 * Registered by `workers/index.ts` on the webhook worker's `'failed'` event —
 * same "flip to a durable terminal state only once BullMQ has genuinely given
 * up" shape as `handleIntegrationSyncJobExhausted`/`handleNotificationJobExhausted`.
 * Marks both the `IntegrationJob` row `DEAD_LETTER` and the originating
 * `IntegrationWebhookLog` row `FAILED` (PRD §17 Step 7 "dead letter handling").
 */
export async function handleIntegrationWebhookJobExhausted(job: Job<IntegrationWebhookJobData> | undefined, err: Error): Promise<void> {
  if (!job) return;
  const attempts = job.opts.attempts ?? 1;
  const isFinalAttempt = job.attemptsMade >= attempts;

  const jobRow = await jobRepository.findByQueueJobId(job.data.webhookLogId);
  if (jobRow) await jobRepository.markFailed(jobRow.id, err.message, isFinalAttempt);
  if (isFinalAttempt) await webhookLogRepository.markFailed(job.data.webhookLogId, err.message);
}
