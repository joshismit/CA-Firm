import { PrismaClient, Prisma, TaskReminder, TaskReminderType } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';

export interface RecordTaskReminderInput {
  taskId: string;
  userId: string;
  type: TaskReminderType;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Task Reminder Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Data access for the `TaskReminder` idempotency ledger — see that model's
 * header comment in schema.prisma for why it's a separate table from
 * `Notification`. Inherits tenant scoping from `BaseRepository`, but every
 * method here passes `ignoreSoftDelete: true` — the model has no `deletedAt`
 * column (a sent-reminder record is permanent, same reasoning as
 * `AuditLogRepository`).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class TaskReminderRepository extends BaseRepository<Prisma.TaskReminderDelegate, TaskReminder> {
  constructor(prisma: PrismaClient) {
    super(prisma.taskReminder, prisma);
  }

  /**
   * Which (taskId, userId) pairs already have a `type` reminder recorded,
   * restricted to the given task IDs — one query per reminder type per scan,
   * not one exists-check per candidate task. Returns bare `TaskReminder` rows
   * (just `taskId`/`userId`) for the caller to key a `Set` off of.
   */
  async findExisting(
    taskIds: string[],
    type: TaskReminderType,
    options: RepositoryOptions = {},
  ): Promise<Pick<TaskReminder, 'taskId' | 'userId'>[]> {
    if (taskIds.length === 0) return [];

    return this.prisma.taskReminder.findMany({
      where: this.applyFilters({ taskId: { in: taskIds }, type }, { ...options, ignoreSoftDelete: true }),
      select: { taskId: true, userId: true },
    });
  }

  /**
   * Records that a reminder was sent. The row itself is the duplicate-send
   * guard (`@@unique([taskId, userId, type])`) — a caller that races another
   * concurrent scan run gets a Prisma `P2002` here, which `TaskReminderService`
   * catches and treats as "already sent by the other run," not an error.
   */
  async record(input: RecordTaskReminderInput, options: RepositoryOptions): Promise<TaskReminder> {
    return this.create(
      { taskId: input.taskId, userId: input.userId, type: input.type },
      { ...options, ignoreSoftDelete: true },
    );
  }
}
