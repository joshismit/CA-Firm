import { Worker, Job } from 'bullmq';
import { redis } from '@config/redis';
import { logger } from '@config/logger';
import { QUEUE_NAMES, documentReminderQueue } from '@config/queue';
import { DOCUMENT_REMINDER } from '@shared/constants';
import { DocumentReminderService } from '@modules/documents/service/document-reminder.service';

type DocumentReminderJobData = Record<string, never>;

/** Mirrors `workers/billing-reminder.worker.ts` exactly — a thin BullMQ adapter over `DocumentReminderService`. */
export function createDocumentReminderWorker(): Worker<DocumentReminderJobData> {
  return new Worker<DocumentReminderJobData>(
    QUEUE_NAMES.DOCUMENT_REMINDER,
    async (_job: Job<DocumentReminderJobData>) => {
      const service = new DocumentReminderService();
      return service.processReminders();
    },
    { connection: redis },
  );
}

export async function scheduleDocumentReminderJob(): Promise<void> {
  await documentReminderQueue.add(
    DOCUMENT_REMINDER.JOB_NAME,
    {},
    { repeat: { pattern: DOCUMENT_REMINDER.CRON_SCHEDULE }, jobId: DOCUMENT_REMINDER.JOB_NAME },
  );
  logger.info({ cron: DOCUMENT_REMINDER.CRON_SCHEDULE }, 'Document reminder scan scheduled');
}
