/** See the identical comment in tests/unit/modules/contacts/contact.service.spec.ts for why @config/database is stubbed. */
jest.mock('@config/database', () => ({ prisma: {} }));

import { Task, TaskReminderType, AuditEventType, NotificationChannel, Prisma } from '@prisma/client';
import { logger } from '@config/logger';
import { AUDIT } from '@shared/constants';
import { TaskReminderService } from '@modules/tasks/service/task-reminder.service';
import { TaskRepository } from '@modules/tasks/repository/task.repository';
import { TaskReminderRepository } from '@modules/tasks/repository/task-reminder.repository';
import { AuditLogRecorder } from '@modules/audit/service/audit-log.recorder';
import { NotificationDispatchService } from '@modules/notifications/service/notification-dispatch.service';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TaskReminderService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Every collaborator is fully mocked — exercises only this service's own
 * logic: due-date range math, the idempotency filter, per-type message copy,
 * channel selection, and that a failure in one collaborator for one task
 * never aborts the rest of the scan. Mirrors
 * `tests/unit/modules/audit/audit-log.service.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_A = 'tenant-11111111-1111-1111-1111-111111111111';
const TENANT_B = 'tenant-22222222-2222-2222-2222-222222222222';
const USER_A = 'user-33333333-3333-3333-3333-333333333333';
const USER_B = 'user-44444444-4444-4444-4444-444444444444';

// A fixed "now" so date-range math is deterministic: 2026-06-15T12:00:00Z.
const NOW = new Date('2026-06-15T12:00:00.000Z');
const TODAY = new Date('2026-06-15T00:00:00.000Z');
const TOMORROW = new Date('2026-06-16T00:00:00.000Z');
const YESTERDAY = new Date('2026-06-14T00:00:00.000Z');

type MockedTaskRepository = { findReminderCandidates: jest.Mock };
type MockedTaskReminderRepository = { findExisting: jest.Mock; record: jest.Mock };
type MockedAuditLogRecorder = { record: jest.Mock };
type MockedNotificationDispatchService = { send: jest.Mock };

function createMockTaskRepository(): MockedTaskRepository {
  return { findReminderCandidates: jest.fn().mockResolvedValue([]) };
}

function createMockTaskReminderRepository(): MockedTaskReminderRepository {
  return { findExisting: jest.fn().mockResolvedValue([]), record: jest.fn().mockResolvedValue({}) };
}

function createMockAuditLogRecorder(): MockedAuditLogRecorder {
  return { record: jest.fn().mockResolvedValue(undefined) };
}

function createMockNotificationDispatchService(): MockedNotificationDispatchService {
  return { send: jest.fn().mockResolvedValue([]) };
}

function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    tenantId: TENANT_A,
    projectId: null,
    assigneeId: USER_A,
    title: 'File GST return',
    description: null,
    status: 'TODO',
    startDate: null,
    dueDate: TODAY,
    completedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    createdBy: null,
    deletedBy: null,
    ...overrides,
  } as Task;
}

function createService(
  taskRepository: MockedTaskRepository = createMockTaskRepository(),
  taskReminderRepository: MockedTaskReminderRepository = createMockTaskReminderRepository(),
  auditLogRecorder: MockedAuditLogRecorder = createMockAuditLogRecorder(),
  notificationDispatchService: MockedNotificationDispatchService = createMockNotificationDispatchService(),
): TaskReminderService {
  return new TaskReminderService(
    taskRepository as unknown as TaskRepository,
    taskReminderRepository as unknown as TaskReminderRepository,
    auditLogRecorder as unknown as AuditLogRecorder,
    notificationDispatchService as unknown as NotificationDispatchService,
  );
}

describe('TaskReminderService', () => {
  let loggerInfoSpy: jest.SpyInstance;
  let loggerWarnSpy: jest.SpyInstance;
  let loggerDebugSpy: jest.SpyInstance;

  beforeEach(() => {
    loggerInfoSpy = jest.spyOn(logger, 'info').mockImplementation(() => undefined as never);
    loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined as never);
    loggerDebugSpy = jest.spyOn(logger, 'debug').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    loggerInfoSpy.mockRestore();
    loggerWarnSpy.mockRestore();
    loggerDebugSpy.mockRestore();
  });

  describe('processReminders — date range computation', () => {
    it('queries findReminderCandidates once per type with the correct [gte, lt) ranges relative to `now`', async () => {
      const taskRepo = createMockTaskRepository();
      const service = createService(taskRepo);

      await service.processReminders(NOW);

      expect(taskRepo.findReminderCandidates).toHaveBeenCalledTimes(3);
      expect(taskRepo.findReminderCandidates).toHaveBeenCalledWith({ gte: TODAY, lt: TOMORROW }, { ignoreTenant: true });
      expect(taskRepo.findReminderCandidates).toHaveBeenCalledWith(
        { gte: TOMORROW, lt: new Date('2026-06-17T00:00:00.000Z') },
        { ignoreTenant: true },
      );
      expect(taskRepo.findReminderCandidates).toHaveBeenCalledWith({ lt: TODAY }, { ignoreTenant: true });
    });

    it('returns a zero summary for every type when there are no candidates', async () => {
      const service = createService();
      const summary = await service.processReminders(NOW);

      expect(summary).toEqual({
        [TaskReminderType.DUE_TODAY]: 0,
        [TaskReminderType.DUE_TOMORROW]: 0,
        [TaskReminderType.OVERDUE]: 0,
      });
    });
  });

  describe('processReminders — dispatch', () => {
    it('sends IN_APP + EMAIL, records the reminder, and writes a system-actor audit entry for an eligible DUE_TODAY task', async () => {
      const task = createMockTask({ id: 'task-today', dueDate: TODAY, tenantId: TENANT_A, assigneeId: USER_A });
      const taskRepo = createMockTaskRepository();
      taskRepo.findReminderCandidates.mockImplementation((range: { gte?: Date }) =>
        Promise.resolve(range.gte?.getTime() === TODAY.getTime() ? [task] : []),
      );
      const reminderRepo = createMockTaskReminderRepository();
      const auditRecorder = createMockAuditLogRecorder();
      const notificationService = createMockNotificationDispatchService();

      const service = createService(taskRepo, reminderRepo, auditRecorder, notificationService);
      const summary = await service.processReminders(NOW);

      expect(notificationService.send).toHaveBeenCalledWith({
        tenantId: TENANT_A,
        userId: USER_A,
        title: 'Task due today',
        message: expect.stringContaining('File GST return'),
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      });
      expect(reminderRepo.record).toHaveBeenCalledWith(
        { taskId: 'task-today', userId: USER_A, type: TaskReminderType.DUE_TODAY },
        { tenantId: TENANT_A },
      );
      expect(auditRecorder.record).toHaveBeenCalledWith({
        tenantId: TENANT_A,
        actorId: AUDIT.SYSTEM_ACTOR_ID,
        actorName: AUDIT.SYSTEM_ACTOR_NAME,
        eventType: AuditEventType.TASK_REMINDER_SENT,
        description: expect.stringContaining('task-today'.length ? 'File GST return' : ''),
        targetType: 'Task',
        targetId: 'task-today',
        ipAddress: null,
      });
      expect(summary[TaskReminderType.DUE_TODAY]).toBe(1);
    });

    it('uses distinct copy for DUE_TOMORROW and OVERDUE', async () => {
      const dueTomorrowTask = createMockTask({ id: 'task-tomorrow', dueDate: TOMORROW, assigneeId: USER_A });
      const overdueTask = createMockTask({ id: 'task-overdue', dueDate: YESTERDAY, assigneeId: USER_B, tenantId: TENANT_B });

      const taskRepo = createMockTaskRepository();
      taskRepo.findReminderCandidates.mockImplementation((range: { gte?: Date; lt?: Date }) => {
        if (range.gte?.getTime() === TOMORROW.getTime()) return Promise.resolve([dueTomorrowTask]);
        if (range.lt?.getTime() === TODAY.getTime() && range.gte === undefined) return Promise.resolve([overdueTask]);
        return Promise.resolve([]);
      });
      const notificationService = createMockNotificationDispatchService();

      const service = createService(taskRepo, undefined, undefined, notificationService);
      const summary = await service.processReminders(NOW);

      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Task due tomorrow', tenantId: TENANT_A, userId: USER_A }),
      );
      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Task overdue', tenantId: TENANT_B, userId: USER_B }),
      );
      expect(summary[TaskReminderType.DUE_TOMORROW]).toBe(1);
      expect(summary[TaskReminderType.OVERDUE]).toBe(1);
    });

    it('skips a task whose (taskId, userId) already has a recorded reminder for this type — no notification, no record, no audit', async () => {
      const task = createMockTask({ id: 'task-already-reminded', assigneeId: USER_A });
      const taskRepo = createMockTaskRepository();
      taskRepo.findReminderCandidates.mockResolvedValue([task]);
      const reminderRepo = createMockTaskReminderRepository();
      reminderRepo.findExisting.mockResolvedValue([{ taskId: 'task-already-reminded', userId: USER_A }]);
      const auditRecorder = createMockAuditLogRecorder();
      const notificationService = createMockNotificationDispatchService();

      const service = createService(taskRepo, reminderRepo, auditRecorder, notificationService);
      const summary = await service.processReminders(NOW);

      expect(notificationService.send).not.toHaveBeenCalled();
      expect(reminderRepo.record).not.toHaveBeenCalled();
      expect(auditRecorder.record).not.toHaveBeenCalled();
      expect(Object.values(summary).reduce((a, b) => a + b, 0)).toBe(0);
    });

    it('batches the idempotency check: findExisting is called once per type with every candidate task id', async () => {
      const taskA = createMockTask({ id: 'task-a', assigneeId: USER_A });
      const taskB = createMockTask({ id: 'task-b', assigneeId: USER_B });
      const taskRepo = createMockTaskRepository();
      taskRepo.findReminderCandidates.mockImplementation((range: { gte?: Date }) =>
        Promise.resolve(range.gte?.getTime() === TODAY.getTime() ? [taskA, taskB] : []),
      );
      const reminderRepo = createMockTaskReminderRepository();

      const service = createService(taskRepo, reminderRepo);
      await service.processReminders(NOW);

      expect(reminderRepo.findExisting).toHaveBeenCalledWith(['task-a', 'task-b'], TaskReminderType.DUE_TODAY, {
        ignoreTenant: true,
      });
    });

    it('does not query findExisting at all when there are no candidates for a type', async () => {
      const reminderRepo = createMockTaskReminderRepository();
      const service = createService(undefined, reminderRepo);

      await service.processReminders(NOW);

      expect(reminderRepo.findExisting).not.toHaveBeenCalled();
    });

    it('never sends to a task with no assignee (defense in depth — findReminderCandidates already filters this)', async () => {
      // Even if a candidate somehow arrives without an assignee, the service must not crash or
      // send to `undefined`/`null`.
      const task = createMockTask({ id: 'task-no-assignee', assigneeId: null });
      const taskRepo = createMockTaskRepository();
      taskRepo.findReminderCandidates.mockImplementation((range: { gte?: Date }) =>
        Promise.resolve(range.gte?.getTime() === TODAY.getTime() ? [task] : []),
      );
      const notificationService = createMockNotificationDispatchService();

      const service = createService(taskRepo, undefined, undefined, notificationService);
      await service.processReminders(NOW);

      expect(notificationService.send).toHaveBeenCalledWith(expect.objectContaining({ userId: null }));
    });
  });

  describe('processReminders — failure handling (one task must never abort the scan)', () => {
    it('logs and skips (does not record or audit) when notification dispatch fails', async () => {
      const task = createMockTask({ id: 'task-fail-notify', assigneeId: USER_A });
      const taskRepo = createMockTaskRepository();
      taskRepo.findReminderCandidates.mockImplementation((range: { gte?: Date }) =>
        Promise.resolve(range.gte?.getTime() === TODAY.getTime() ? [task] : []),
      );
      const reminderRepo = createMockTaskReminderRepository();
      const auditRecorder = createMockAuditLogRecorder();
      const notificationService = createMockNotificationDispatchService();
      notificationService.send.mockRejectedValue(new Error('SMTP down'));

      const service = createService(taskRepo, reminderRepo, auditRecorder, notificationService);
      const summary = await service.processReminders(NOW);

      expect(reminderRepo.record).not.toHaveBeenCalled();
      expect(auditRecorder.record).not.toHaveBeenCalled();
      expect(summary[TaskReminderType.DUE_TODAY]).toBe(0);
      expect(loggerWarnSpy).toHaveBeenCalled();
    });

    it('treats a P2002 (unique constraint) from record() as an already-sent duplicate — logs at debug, skips audit, does not throw', async () => {
      const task = createMockTask({ id: 'task-race', assigneeId: USER_A });
      const taskRepo = createMockTaskRepository();
      taskRepo.findReminderCandidates.mockImplementation((range: { gte?: Date }) =>
        Promise.resolve(range.gte?.getTime() === TODAY.getTime() ? [task] : []),
      );
      const reminderRepo = createMockTaskReminderRepository();
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.8.0',
      });
      reminderRepo.record.mockRejectedValue(p2002);
      const auditRecorder = createMockAuditLogRecorder();

      const service = createService(taskRepo, reminderRepo, auditRecorder);
      const summary = await service.processReminders(NOW);

      expect(auditRecorder.record).not.toHaveBeenCalled();
      expect(summary[TaskReminderType.DUE_TODAY]).toBe(0);
      expect(loggerDebugSpy).toHaveBeenCalled();
      expect(loggerWarnSpy).not.toHaveBeenCalled();
    });

    it('logs a warning (not debug) for a non-P2002 record() failure', async () => {
      const task = createMockTask({ id: 'task-db-error', assigneeId: USER_A });
      const taskRepo = createMockTaskRepository();
      taskRepo.findReminderCandidates.mockImplementation((range: { gte?: Date }) =>
        Promise.resolve(range.gte?.getTime() === TODAY.getTime() ? [task] : []),
      );
      const reminderRepo = createMockTaskReminderRepository();
      reminderRepo.record.mockRejectedValue(new Error('connection reset'));

      const service = createService(taskRepo, reminderRepo);
      const summary = await service.processReminders(NOW);

      expect(summary[TaskReminderType.DUE_TODAY]).toBe(0);
      expect(loggerWarnSpy).toHaveBeenCalled();
      expect(loggerDebugSpy).not.toHaveBeenCalled();
    });

    it('continues processing remaining candidates after one task fails', async () => {
      const failingTask = createMockTask({ id: 'task-fails', assigneeId: USER_A });
      const okTask = createMockTask({ id: 'task-ok', assigneeId: USER_B, tenantId: TENANT_B });
      const taskRepo = createMockTaskRepository();
      taskRepo.findReminderCandidates.mockImplementation((range: { gte?: Date }) =>
        Promise.resolve(range.gte?.getTime() === TODAY.getTime() ? [failingTask, okTask] : []),
      );
      const notificationService = createMockNotificationDispatchService();
      notificationService.send.mockImplementation((input: { userId: string }) =>
        input.userId === USER_A ? Promise.reject(new Error('SMTP down')) : Promise.resolve([]),
      );
      const reminderRepo = createMockTaskReminderRepository();

      const service = createService(taskRepo, reminderRepo, undefined, notificationService);
      const summary = await service.processReminders(NOW);

      expect(reminderRepo.record).toHaveBeenCalledTimes(1);
      expect(reminderRepo.record).toHaveBeenCalledWith(
        { taskId: 'task-ok', userId: USER_B, type: TaskReminderType.DUE_TODAY },
        { tenantId: TENANT_B },
      );
      expect(summary[TaskReminderType.DUE_TODAY]).toBe(1);
    });
  });

  it('logs a completion summary', async () => {
    const service = createService();
    await service.processReminders(NOW);

    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        [TaskReminderType.DUE_TODAY]: 0,
        [TaskReminderType.DUE_TOMORROW]: 0,
        [TaskReminderType.OVERDUE]: 0,
      }),
      'Task reminder scan complete',
    );
  });
});
