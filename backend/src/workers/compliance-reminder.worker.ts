import { Worker, Job } from 'bullmq';
import { redis } from '@config/redis';
import { logger } from '@config/logger';
import { QUEUE_NAMES, complianceReminderQueue } from '@config/queue';
import { COMPLIANCE_REMINDER } from '@shared/constants';
import { ComplianceReminderService } from '@modules/compliance/service/compliance-reminder.service';

type ComplianceReminderJobData = Record<string, never>;

/** Mirrors `workers/billing-reminder.worker.ts` exactly — a thin BullMQ adapter over `ComplianceReminderService`. */
export function createComplianceReminderWorker(): Worker<ComplianceReminderJobData> {
  return new Worker<ComplianceReminderJobData>(
    QUEUE_NAMES.COMPLIANCE_REMINDER,
    async (_job: Job<ComplianceReminderJobData>) => {
      const service = new ComplianceReminderService();
      return service.processReminders();
    },
    { connection: redis },
  );
}

export async function scheduleComplianceReminderJob(): Promise<void> {
  await complianceReminderQueue.add(
    COMPLIANCE_REMINDER.JOB_NAME,
    {},
    { repeat: { pattern: COMPLIANCE_REMINDER.CRON_SCHEDULE }, jobId: COMPLIANCE_REMINDER.JOB_NAME },
  );
  logger.info({ cron: COMPLIANCE_REMINDER.CRON_SCHEDULE }, 'Compliance reminder scan scheduled');
}
