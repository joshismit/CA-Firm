import { Worker, Job } from 'bullmq';
import { redis } from '@config/redis';
import { logger } from '@config/logger';
import { QUEUE_NAMES, billingReminderQueue } from '@config/queue';
import { BILLING_REMINDER } from '@shared/constants';
import { BillingReminderService } from '@modules/client-billing/service/billing-reminder.service';

/** No payload — every run scans the same fixed cases across every tenant, nothing to parameterize per job. */
type BillingReminderJobData = Record<string, never>;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Billing Reminder Worker (PRD §11.12)
 * ─────────────────────────────────────────────────────────────────────────────
 * Mirrors `workers/task-reminder.worker.ts` exactly — a thin BullMQ adapter
 * over `BillingReminderService`, which owns all the actual scan/dispatch/
 * idempotency logic (unit/integration-tested on its own).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function createBillingReminderWorker(): Worker<BillingReminderJobData> {
  return new Worker<BillingReminderJobData>(
    QUEUE_NAMES.BILLING_REMINDER,
    async (_job: Job<BillingReminderJobData>) => {
      const service = new BillingReminderService();
      return service.processReminders();
    },
    { connection: redis },
  );
}

/** Idempotent — see `scheduleTaskReminderJob()`'s identical comment. Called once from `workers/index.ts` at process startup. */
export async function scheduleBillingReminderJob(): Promise<void> {
  await billingReminderQueue.add(
    BILLING_REMINDER.JOB_NAME,
    {},
    { repeat: { pattern: BILLING_REMINDER.CRON_SCHEDULE }, jobId: BILLING_REMINDER.JOB_NAME },
  );
  logger.info({ cron: BILLING_REMINDER.CRON_SCHEDULE }, 'Billing reminder scan scheduled');
}
