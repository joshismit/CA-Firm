import { TaskStatus, TaskReminderType, AuditEventType, NotificationChannel } from '@prisma/client';
import { prisma } from '@config/database';
import { TaskReminderService } from '@modules/tasks';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Task Reminder Scan — Integration Tests (PRD §4.2)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * No HTTP layer here by design — task reminders are fully automatic (no
 * tenant-configurable settings, so no REST endpoint exists; see
 * `TaskReminderService`'s header comment). "Integration" here means what it
 * means for `AuditLogRecorder`'s own write path: every real collaborator
 * (`TaskRepository`, `TaskReminderRepository`, `AuditLogRecorder`,
 * `NotificationDispatchService`) wired together against a real Postgres
 * database and a real Redis-backed queue — the actual cross-module chain
 * `workers/task-reminder.worker.ts` runs on a schedule, minus BullMQ's own
 * scheduling/consumption machinery.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

// Fixed "now" so every assertion is deterministic regardless of when this suite runs.
const NOW = new Date('2026-06-15T12:00:00.000Z');
const DUE_TODAY = new Date('2026-06-15T00:00:00.000Z');
const DUE_TOMORROW = new Date('2026-06-16T00:00:00.000Z');
const OVERDUE_DATE = new Date('2026-06-10T00:00:00.000Z');
const FAR_FUTURE = new Date('2026-07-01T00:00:00.000Z');

interface SeededTaskIds {
  dueToday: string;
  dueTomorrow: string;
  overdue: string;
  completedOverdue: string;
  cancelledDueToday: string;
  noAssigneeDueToday: string;
  farFuture: string;
  tenantBDueToday: string;
}

describe('TaskReminderService.processReminders — integration', () => {
  let fixtures: TestFixtures;
  let ids: SeededTaskIds;
  let taskIds: string[];

  beforeAll(async () => {
    fixtures = await seedFixtures(prisma);

    const [dueToday, dueTomorrow, overdue, completedOverdue, cancelledDueToday, noAssigneeDueToday, farFuture, tenantBDueToday] =
      await Promise.all([
        prisma.task.create({
          data: { tenantId: fixtures.tenantA.tenantId, assigneeId: fixtures.tenantA.userId, title: 'Tenant A — due today', status: TaskStatus.TODO, dueDate: DUE_TODAY },
        }),
        prisma.task.create({
          data: { tenantId: fixtures.tenantA.tenantId, assigneeId: fixtures.tenantA.userId, title: 'Tenant A — due tomorrow', status: TaskStatus.IN_PROGRESS, dueDate: DUE_TOMORROW },
        }),
        prisma.task.create({
          data: { tenantId: fixtures.tenantA.tenantId, assigneeId: fixtures.tenantA.userId, title: 'Tenant A — overdue', status: TaskStatus.REVIEW, dueDate: OVERDUE_DATE },
        }),
        prisma.task.create({
          data: { tenantId: fixtures.tenantA.tenantId, assigneeId: fixtures.tenantA.userId, title: 'Tenant A — completed but overdue', status: TaskStatus.COMPLETED, dueDate: OVERDUE_DATE, completedAt: NOW },
        }),
        prisma.task.create({
          data: { tenantId: fixtures.tenantA.tenantId, assigneeId: fixtures.tenantA.userId, title: 'Tenant A — cancelled but due today', status: TaskStatus.CANCELLED, dueDate: DUE_TODAY },
        }),
        prisma.task.create({
          data: { tenantId: fixtures.tenantA.tenantId, assigneeId: null, title: 'Tenant A — due today, unassigned', status: TaskStatus.TODO, dueDate: DUE_TODAY },
        }),
        prisma.task.create({
          data: { tenantId: fixtures.tenantA.tenantId, assigneeId: fixtures.tenantA.userId, title: 'Tenant A — far future', status: TaskStatus.TODO, dueDate: FAR_FUTURE },
        }),
        prisma.task.create({
          data: { tenantId: fixtures.tenantB.tenantId, assigneeId: fixtures.tenantB.userId, title: 'Tenant B — due today', status: TaskStatus.TODO, dueDate: DUE_TODAY },
        }),
      ]);

    ids = {
      dueToday: dueToday.id,
      dueTomorrow: dueTomorrow.id,
      overdue: overdue.id,
      completedOverdue: completedOverdue.id,
      cancelledDueToday: cancelledDueToday.id,
      noAssigneeDueToday: noAssigneeDueToday.id,
      farFuture: farFuture.id,
      tenantBDueToday: tenantBDueToday.id,
    };
    taskIds = Object.values(ids);
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { targetType: 'Task', targetId: { in: taskIds } } });
    await prisma.notification.deleteMany({ where: { userId: { in: [fixtures.tenantA.userId, fixtures.tenantB.userId] } } });
    await prisma.taskReminder.deleteMany({ where: { taskId: { in: taskIds } } });
    await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  it('sends exactly the three eligible reminders (DUE_TODAY, DUE_TOMORROW, OVERDUE) and skips terminal/unassigned/out-of-range tasks', async () => {
    const service = new TaskReminderService();
    const summary = await service.processReminders(NOW);

    expect(summary).toEqual({
      [TaskReminderType.DUE_TODAY]: 2, // tenant A's due-today task + tenant B's due-today task
      [TaskReminderType.DUE_TOMORROW]: 1,
      [TaskReminderType.OVERDUE]: 1,
    });
  });

  it('recorded a TaskReminder row for each eligible task, and none for the ineligible ones', async () => {
    const reminders = await prisma.taskReminder.findMany({ where: { taskId: { in: taskIds } } });
    const remindedTaskIds = reminders.map((r) => r.taskId);

    expect(remindedTaskIds).toEqual(expect.arrayContaining([ids.dueToday, ids.dueTomorrow, ids.overdue]));
    expect(remindedTaskIds).not.toContain(ids.completedOverdue);
    expect(remindedTaskIds).not.toContain(ids.cancelledDueToday);
    expect(remindedTaskIds).not.toContain(ids.noAssigneeDueToday);
    expect(remindedTaskIds).not.toContain(ids.farFuture);

    const dueTodayReminder = reminders.find((r) => r.taskId === ids.dueToday);
    expect(dueTodayReminder).toMatchObject({ userId: fixtures.tenantA.userId, type: TaskReminderType.DUE_TODAY, tenantId: fixtures.tenantA.tenantId });
  });

  it('dispatched IN_APP and EMAIL notifications to the assignee for each eligible task', async () => {
    const notifications = await prisma.notification.findMany({ where: { userId: fixtures.tenantA.userId } });

    // 3 eligible tenant-A tasks × 2 channels each.
    expect(notifications).toHaveLength(6);
    expect(notifications.filter((n) => n.channel === NotificationChannel.IN_APP)).toHaveLength(3);
    expect(notifications.filter((n) => n.channel === NotificationChannel.EMAIL)).toHaveLength(3);
    expect(notifications.map((n) => n.title)).toEqual(
      expect.arrayContaining(['Task due today', 'Task due tomorrow', 'Task overdue']),
    );
  });

  it('wrote a system-actor AuditLog entry (TASK_REMINDER_SENT) for each eligible task, scoped to the right tenant', async () => {
    const entries = await prisma.auditLog.findMany({ where: { targetType: 'Task', targetId: { in: taskIds } } });
    expect(entries).toHaveLength(4); // 3 tenant-A + 1 tenant-B

    const dueTodayEntry = entries.find((e) => e.targetId === ids.dueToday);
    expect(dueTodayEntry).toMatchObject({
      eventType: AuditEventType.TASK_REMINDER_SENT,
      actorId: '00000000-0000-0000-0000-000000000000',
      actorName: 'System',
      tenantId: fixtures.tenantA.tenantId,
    });

    const tenantBEntry = entries.find((e) => e.tenantId === fixtures.tenantB.tenantId);
    expect(tenantBEntry).toBeDefined();
    expect(entries.every((e) => e.tenantId === fixtures.tenantA.tenantId || e.tenantId === fixtures.tenantB.tenantId)).toBe(true);
  });

  it('tenant isolation: tenant B only ever sees its own task\'s reminder, never tenant A\'s', async () => {
    const tenantBReminders = await prisma.taskReminder.findMany({ where: { tenantId: fixtures.tenantB.tenantId } });
    expect(tenantBReminders).toHaveLength(1);
    expect(tenantBReminders[0].taskId).toBe(ids.tenantBDueToday);
    expect(tenantBReminders[0].userId).toBe(fixtures.tenantB.userId);

    const tenantBNotifications = await prisma.notification.findMany({ where: { userId: fixtures.tenantB.userId } });
    expect(tenantBNotifications).toHaveLength(2); // IN_APP + EMAIL, one task only
  });

  it('idempotency: running the scan again sends nothing new (same summary, same row counts)', async () => {
    const service = new TaskReminderService();
    const secondSummary = await service.processReminders(NOW);

    expect(secondSummary).toEqual({
      [TaskReminderType.DUE_TODAY]: 0,
      [TaskReminderType.DUE_TOMORROW]: 0,
      [TaskReminderType.OVERDUE]: 0,
    });

    const reminders = await prisma.taskReminder.findMany({ where: { taskId: { in: taskIds } } });
    expect(reminders).toHaveLength(4); // unchanged from the first run

    const notifications = await prisma.notification.findMany({ where: { userId: fixtures.tenantA.userId } });
    expect(notifications).toHaveLength(6); // unchanged

    const auditEntries = await prisma.auditLog.findMany({ where: { targetType: 'Task', targetId: { in: taskIds } } });
    expect(auditEntries).toHaveLength(4); // unchanged
  });

  it('an OVERDUE task that stays overdue the next day is not reminded a second time for that same type', async () => {
    // Simulate "the next day". OVERDUE's condition (`dueDate < today`) still matches `overdue` —
    // its (taskId, userId, OVERDUE) reminder already exists from the first run, so no duplicate.
    // `dueToday` (due 06-15) is now ALSO `< today` (06-16) for the first time — a *different*
    // reminder type (OVERDUE, not DUE_TODAY) than the one it already has, so it legitimately gets
    // a fresh reminder. This is the intended "self-healing" behavior, not a bug: a task that was
    // due today and is still open the next day should be re-flagged as overdue.
    const nextDay = new Date('2026-06-16T12:00:00.000Z');
    const service = new TaskReminderService();
    await service.processReminders(nextDay);

    const overdueTaskReminders = await prisma.taskReminder.findMany({ where: { taskId: ids.overdue } });
    expect(overdueTaskReminders).toHaveLength(1); // still just the one OVERDUE reminder — no duplicate

    const dueTodayTaskReminders = await prisma.taskReminder.findMany({ where: { taskId: ids.dueToday } });
    expect(dueTodayTaskReminders.map((r) => r.type).sort()).toEqual([TaskReminderType.DUE_TODAY, TaskReminderType.OVERDUE].sort());
  });
});
