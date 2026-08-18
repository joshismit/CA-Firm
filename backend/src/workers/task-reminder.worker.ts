import { Worker, Job } from 'bullmq';
import { redis } from '@config/redis';
import { logger } from '@config/logger';
import { QUEUE_NAMES, taskReminderQueue } from '@config/queue';
import { TASK_REMINDER } from '@shared/constants';
import { TaskReminderService } from '@modules/tasks';

/** No payload — every run scans the same fixed three cases across every tenant, nothing to parameterize per job. */
type TaskReminderJobData = Record<string, never>;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Task Reminder Worker (PRD §4.2 — "Manage tasks and reminders")
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Consumes `QUEUE_NAMES.TASK_REMINDER` — the one *repeatable* job in this
 * codebase (every other worker here reacts to a business event; this one
 * runs on a fixed schedule instead, via `scheduleTaskReminderJob()` below).
 * The job handler is a thin adapter: all the actual scan/dispatch/idempotency
 * logic lives in `TaskReminderService`, unit- and integration-tested on its
 * own — this function exists only to bridge BullMQ's `Worker` callback shape
 * to it, the same division of responsibility `notification.worker.ts` has
 * with `NotificationDispatchService`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function createTaskReminderWorker(): Worker<TaskReminderJobData> {
  return new Worker<TaskReminderJobData>(
    QUEUE_NAMES.TASK_REMINDER,
    async (_job: Job<TaskReminderJobData>) => {
      const service = new TaskReminderService();
      return service.processReminders();
    },
    { connection: redis },
  );
}

/**
 * Schedules the recurring scan onto `taskReminderQueue`. BullMQ keys a
 * repeatable job by its `{ name, repeat }` pair (`jobId` pins that key
 * explicitly here), so calling this on every worker-process boot is
 * idempotent — it reschedules the same job, never accumulates duplicates.
 * Called once from `workers/index.ts` at process startup, not from the API
 * process — scheduling is this process's responsibility, matching how only
 * this file consumes the queue too.
 */
export async function scheduleTaskReminderJob(): Promise<void> {
  await taskReminderQueue.add(
    TASK_REMINDER.JOB_NAME,
    {},
    {
      repeat: { pattern: TASK_REMINDER.CRON_SCHEDULE },
      jobId: TASK_REMINDER.JOB_NAME,
    },
  );
  logger.info({ cron: TASK_REMINDER.CRON_SCHEDULE }, 'Task reminder scan scheduled');
}
