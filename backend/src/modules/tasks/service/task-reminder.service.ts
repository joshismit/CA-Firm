import { Task, TaskReminderType, AuditEventType, NotificationChannel, Prisma } from '@prisma/client';
import { prisma } from '@config/database';
import { logger } from '@config/logger';
import { AUDIT } from '@shared/constants';
import { AuditLogRecorder } from '@modules/audit';
// Concrete path, not the `@modules/notifications` barrel — see
// `middlewares/tenant.middleware.ts`'s header comment for why.
import { NotificationDispatchService } from '@modules/notifications/service/notification-dispatch.service';
import { TaskRepository } from '../repository/task.repository';
import { TaskReminderRepository } from '../repository/task-reminder.repository';

/** How many reminders were actually sent in one `processReminders()` run, keyed by type — what the worker logs and what tests assert against. */
export type TaskReminderRunSummary = Record<TaskReminderType, number>;

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** `en-IN`, UTC — matches `LOCALE.DEFAULT_LOCALE`; UTC specifically because `Task.dueDate` is a
 *  date-only column stored at UTC midnight, so formatting in any other zone risks shifting the
 *  displayed day by one. */
function formatDueDate(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function buildReminderCopy(type: TaskReminderType, task: Task): { title: string; message: string } {
  // `task.dueDate` is non-null here — every candidate came from
  // `TaskRepository.findReminderCandidates()`, which always filters on `dueDate`.
  const dueDate = formatDueDate(task.dueDate as Date);

  switch (type) {
    case TaskReminderType.DUE_TOMORROW:
      return { title: 'Task due tomorrow', message: `Task "${task.title}" is due tomorrow (${dueDate}).` };
    case TaskReminderType.DUE_TODAY:
      return { title: 'Task due today', message: `Task "${task.title}" is due today (${dueDate}).` };
    case TaskReminderType.OVERDUE:
      return { title: 'Task overdue', message: `Task "${task.title}" is overdue — it was due ${dueDate}.` };
  }
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Task Reminder Service (PRD §4.2 — "Manage tasks and reminders")
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Runs on a schedule (`workers/task-reminder.worker.ts`, once daily — see
 * `TASK_REMINDER.CRON_SCHEDULE`), not per-request — no HTTP endpoint exists
 * or is needed, since there is nothing tenant-configurable about reminders
 * (three fixed cases, always on). Mirrors `AuditLogRecorder`/
 * `NotificationDispatchService`'s own shape for the same reason: explicit
 * constructor DI, explicit params, no `BaseService`/`Request` coupling — a
 * cron job has no request to derive `tenantId`/`userId` from, and this scan
 * runs across every tenant in one pass, not scoped to one.
 *
 * Delivery reuses `NotificationDispatchService` exactly as every other module
 * does — no bespoke email/SMS/WhatsApp sending here. `IN_APP` + `EMAIL` (not
 * SMS/WhatsApp): a deadline reminder is exactly the kind of thing that should
 * reach someone outside the app, unlike this codebase's other notifications
 * (task assignment, role changes, ...) which are deliberately `IN_APP`-only —
 * see e.g. `TaskService.notify()`'s header comment for that default.
 *
 * Idempotency is enforced two ways: the in-memory `alreadySent` set (built
 * from one batched `TaskReminderRepository.findExisting()` query per type,
 * not one exists-check per task) avoids redundant work on the common path,
 * and `TaskReminder`'s own `@@unique([taskId, userId, type])` constraint is
 * the actual guarantee — even a second, overlapping scan run cannot double-send
 * (see `sendReminder()`'s handling of a `P2002` there).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class TaskReminderService {
  constructor(
    private readonly taskRepository: TaskRepository = new TaskRepository(prisma),
    private readonly taskReminderRepository: TaskReminderRepository = new TaskReminderRepository(prisma),
    private readonly auditLogRecorder: AuditLogRecorder = new AuditLogRecorder(),
    private readonly notificationDispatchService: NotificationDispatchService = new NotificationDispatchService(),
  ) {}

  async processReminders(now: Date = new Date()): Promise<TaskReminderRunSummary> {
    const todayStart = startOfUtcDay(now);
    const tomorrowStart = addUtcDays(todayStart, 1);
    const dayAfterTomorrowStart = addUtcDays(todayStart, 2);

    const dueDateRangeByType: Record<TaskReminderType, { gte?: Date; lt?: Date }> = {
      [TaskReminderType.DUE_TODAY]: { gte: todayStart, lt: tomorrowStart },
      [TaskReminderType.DUE_TOMORROW]: { gte: tomorrowStart, lt: dayAfterTomorrowStart },
      [TaskReminderType.OVERDUE]: { lt: todayStart },
    };

    const summary = {} as TaskReminderRunSummary;
    for (const type of Object.values(TaskReminderType)) {
      // eslint-disable-next-line no-await-in-loop -- exactly 3 iterations (one per reminder type); each type's dispatch must finish before the next type's idempotency check is meaningful.
      summary[type] = await this.processType(type, dueDateRangeByType[type]);
    }

    logger.info(summary, 'Task reminder scan complete');
    return summary;
  }

  private async processType(type: TaskReminderType, dueDateRange: { gte?: Date; lt?: Date }): Promise<number> {
    const candidates = await this.taskRepository.findReminderCandidates(dueDateRange, { ignoreTenant: true });
    if (candidates.length === 0) return 0;

    const existing = await this.taskReminderRepository.findExisting(
      candidates.map((task) => task.id),
      type,
      { ignoreTenant: true },
    );
    const alreadySent = new Set(existing.map((row) => `${row.taskId}:${row.userId}`));

    let sentCount = 0;
    for (const task of candidates) {
      // Guaranteed non-null — `findReminderCandidates()` always filters `assigneeId: { not: null }`.
      const userId = task.assigneeId as string;
      if (alreadySent.has(`${task.id}:${userId}`)) continue;

      // eslint-disable-next-line no-await-in-loop -- each task's dispatch+record+audit must complete (and be reflected in `alreadySent`-equivalent state) before considering it done; per-tenant/per-run volume is bounded by real due-task counts, not unbounded.
      const sent = await this.sendReminder(task, userId, type);
      if (sent) sentCount += 1;
    }

    return sentCount;
  }

  /** Never throws — every failure mode is logged and treated as "this task's reminder didn't go out this run," not a reason to abort the rest of the scan. */
  private async sendReminder(task: Task, userId: string, type: TaskReminderType): Promise<boolean> {
    const { title, message } = buildReminderCopy(type, task);

    try {
      await this.notificationDispatchService.send({
        tenantId: task.tenantId,
        userId,
        title,
        message,
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      });
    } catch (err) {
      logger.warn({ err, taskId: task.id, userId, type }, 'Failed to dispatch task reminder notification — a future scan may retry it');
      return false;
    }

    try {
      await this.taskReminderRepository.record({ taskId: task.id, userId, type }, { tenantId: task.tenantId });
    } catch (err) {
      if (this.isDuplicateReminder(err)) {
        logger.debug(
          { taskId: task.id, userId, type },
          'Task reminder already recorded by a concurrent run — the notification just sent was a harmless duplicate',
        );
      } else {
        logger.warn({ err, taskId: task.id, userId, type }, 'Failed to record task reminder — a future scan may resend it');
      }
      return false;
    }

    // Never throws (swallows its own errors) — see AuditLogRecorder's header comment.
    await this.auditLogRecorder.record({
      tenantId: task.tenantId,
      actorId: AUDIT.SYSTEM_ACTOR_ID,
      actorName: AUDIT.SYSTEM_ACTOR_NAME,
      eventType: AuditEventType.TASK_REMINDER_SENT,
      description: `Sent "${type}" reminder for task "${task.title}"`,
      targetType: 'Task',
      targetId: task.id,
      ipAddress: null,
    });

    return true;
  }

  private isDuplicateReminder(err: unknown): boolean {
    return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
  }
}
