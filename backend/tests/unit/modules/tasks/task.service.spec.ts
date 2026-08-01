import { Request } from 'express';
import { Task, TaskStatus, NotificationChannel } from '@prisma/client';

/**
 * `TaskService`'s constructor defaults to `new TaskRepository(prisma)` (the
 * real `@config/database` singleton) when no repository is injected. These
 * tests always inject an explicit mock repository, so the real `prisma`
 * export is never used — but merely *importing* `TaskService` transitively
 * imports `@config/database`, whose top-level `new PrismaClient(...)` call
 * currently throws at construction time (pre-existing issue: Prisma 7's
 * "client" engine requires a driver adapter that isn't wired up anywhere in
 * this codebase yet — same issue worked around in
 * `project.service.spec.ts`). Stubbing the module here is test-only and does
 * not touch production code.
 */
jest.mock('@config/database', () => ({ prisma: {} }));

import { UserRole } from '@shared/enums';
import { ConflictError, NotFoundError, ValidationError } from '@shared/errors';
import { TaskService } from '@modules/tasks/service/task.service';
import { TaskRepository } from '@modules/tasks/repository/task.repository';
import type { NotificationDispatchService } from '@modules/notifications/service/notification-dispatch.service';
import {
  CreateTaskDto,
  ListTasksQueryDto,
  UpdateTaskStatusDto,
} from '@modules/tasks/dto/task.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TaskService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `TaskRepository` is fully mocked — these tests exercise only the business
 * logic in `TaskService` (guards, transitions, cross-field validation),
 * never a real database. Mirrors `project.service.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';

type MockedTaskRepository = {
  [K in
    | 'findById'
    | 'create'
    | 'update'
    | 'delete'
    | 'restore'
    | 'findByStatus'
    | 'findByProject'
    | 'findByAssignee'
    | 'findOverdue'
    | 'search'
    | 'countByStatus'
    | 'countByProject']: jest.Mock;
};

function createMockRepository(): MockedTaskRepository {
  return {
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    restore: jest.fn(),
    findByStatus: jest.fn(),
    findByProject: jest.fn(),
    findByAssignee: jest.fn(),
    findOverdue: jest.fn(),
    search: jest.fn(),
    countByStatus: jest.fn(),
    countByProject: jest.fn(),
  };
}

function createFakeRequest(): Request {
  return {
    tenant: { id: TENANT_ID, slug: 'acme', name: 'Acme & Co', planCode: 'professional', isActive: true },
    user: { id: USER_ID, email: 'manager@acme.test', role: UserRole.TENANT_ADMIN, tenantId: TENANT_ID, permissions: [] },
    correlationId: 'test-correlation-id',
  } as unknown as Request;
}

function createMockTask(overrides: Partial<Task> = {}): Task {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'task-33333333-3333-3333-3333-333333333333',
    tenantId: TENANT_ID,
    projectId: null,
    assigneeId: null,
    title: 'Prepare draft financials',
    description: null,
    status: TaskStatus.TODO,
    startDate: null,
    dueDate: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdBy: USER_ID,
    deletedBy: null,
    ...overrides,
  };
}

function createMockNotificationDispatchService(): { send: jest.Mock } {
  return { send: jest.fn().mockResolvedValue([]) };
}

function createService(
  repository: MockedTaskRepository,
  notificationDispatchService: { send: jest.Mock } = createMockNotificationDispatchService(),
): TaskService {
  return new TaskService(
    createFakeRequest(),
    repository as unknown as TaskRepository,
    undefined,
    notificationDispatchService as unknown as NotificationDispatchService,
  );
}

describe('TaskService', () => {
  // ────────────────────────────────────────────────────────────────────────
  // createTask
  // ────────────────────────────────────────────────────────────────────────
  describe('createTask', () => {
    const dto: CreateTaskDto = {
      title: 'Prepare draft financials',
    };

    it('creates a task in TODO status', async () => {
      const repo = createMockRepository();
      const created = createMockTask();
      repo.create.mockResolvedValue(created);

      const service = createService(repo);
      const result = await service.createTask(dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: dto.title,
          projectId: null,
          assigneeId: null,
          description: null,
          startDate: null,
          dueDate: null,
          status: TaskStatus.TODO,
          createdBy: USER_ID,
        }),
        { tenantId: TENANT_ID },
      );
      expect(result).toBe(created);
    });

    it('passes through projectId/assigneeId/description when provided, and notifies the assignee', async () => {
      const repo = createMockRepository();
      const created = createMockTask({ assigneeId: 'user-assignee-1', title: dto.title });
      repo.create.mockResolvedValue(created);

      const notificationDispatchService = createMockNotificationDispatchService();
      const service = createService(repo, notificationDispatchService);
      await service.createTask({
        ...dto,
        projectId: 'project-1',
        assigneeId: 'user-assignee-1',
        description: 'Compile Q4 figures',
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'project-1',
          assigneeId: 'user-assignee-1',
          description: 'Compile Q4 figures',
        }),
        { tenantId: TENANT_ID },
      );
      expect(notificationDispatchService.send).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        userId: 'user-assignee-1',
        title: 'Task assigned',
        message: expect.stringContaining(dto.title),
        channels: [NotificationChannel.IN_APP],
      });
    });

    it('does NOT notify when the task has no assignee', async () => {
      const repo = createMockRepository();
      repo.create.mockResolvedValue(createMockTask({ assigneeId: null }));

      const notificationDispatchService = createMockNotificationDispatchService();
      const service = createService(repo, notificationDispatchService);
      await service.createTask(dto);

      expect(notificationDispatchService.send).not.toHaveBeenCalled();
    });

    it('does NOT notify when the task is self-assigned', async () => {
      const repo = createMockRepository();
      repo.create.mockResolvedValue(createMockTask({ assigneeId: USER_ID }));

      const notificationDispatchService = createMockNotificationDispatchService();
      const service = createService(repo, notificationDispatchService);
      await service.createTask({ ...dto, assigneeId: USER_ID });

      expect(notificationDispatchService.send).not.toHaveBeenCalled();
    });

    it('throws ValidationError when dueDate is before startDate (validation failure)', async () => {
      const repo = createMockRepository();
      const invalidDto: CreateTaskDto = {
        ...dto,
        startDate: new Date('2026-03-01'),
        dueDate: new Date('2026-02-01'),
      };

      const service = createService(repo);

      await expect(service.createTask(invalidDto)).rejects.toThrow(ValidationError);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // updateTask
  // ────────────────────────────────────────────────────────────────────────
  describe('updateTask', () => {
    it('updates mutable fields', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask());
      const updated = createMockTask({ title: 'Prepare final financials' });
      repo.update.mockResolvedValue(updated);

      const service = createService(repo);
      const result = await service.updateTask('task-1', { title: 'Prepare final financials' });

      expect(repo.update).toHaveBeenCalledWith(
        'task-1',
        { title: 'Prepare final financials' },
        { tenantId: TENANT_ID },
      );
      expect(result).toBe(updated);
    });

    it('throws NotFoundError when the task does not exist', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.updateTask('missing-id', { title: 'New title' })).rejects.toThrow(
        NotFoundError,
      );
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('notifies the new assignee on a genuine reassignment', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask({ assigneeId: 'old-assignee' }));
      const updated = createMockTask({ assigneeId: 'new-assignee' });
      repo.update.mockResolvedValue(updated);

      const notificationDispatchService = createMockNotificationDispatchService();
      const service = createService(repo, notificationDispatchService);
      await service.updateTask('task-1', { assigneeId: 'new-assignee' });

      expect(notificationDispatchService.send).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        userId: 'new-assignee',
        title: 'Task assigned',
        message: expect.any(String),
        channels: [NotificationChannel.IN_APP],
      });
    });

    it('does NOT notify when resubmitting the same assigneeId (idempotent — no duplicate on retry)', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask({ assigneeId: 'same-assignee' }));
      repo.update.mockResolvedValue(createMockTask({ assigneeId: 'same-assignee' }));

      const notificationDispatchService = createMockNotificationDispatchService();
      const service = createService(repo, notificationDispatchService);
      await service.updateTask('task-1', { assigneeId: 'same-assignee' });

      expect(notificationDispatchService.send).not.toHaveBeenCalled();
    });

    it('does NOT notify when assigneeId is not part of the update at all', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask({ assigneeId: 'existing-assignee' }));
      repo.update.mockResolvedValue(createMockTask({ assigneeId: 'existing-assignee', title: 'Renamed' }));

      const notificationDispatchService = createMockNotificationDispatchService();
      const service = createService(repo, notificationDispatchService);
      await service.updateTask('task-1', { title: 'Renamed' });

      expect(notificationDispatchService.send).not.toHaveBeenCalled();
    });

    it('throws ValidationError when only dueDate is patched and it precedes the existing startDate (validation failure)', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(
        createMockTask({ startDate: new Date('2026-03-01'), dueDate: new Date('2026-04-01') }),
      );

      const service = createService(repo);

      await expect(
        service.updateTask('task-1', { dueDate: new Date('2026-02-01') }),
      ).rejects.toThrow(ValidationError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('throws ValidationError when only startDate is patched and it comes after the existing dueDate (validation failure)', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(
        createMockTask({ startDate: new Date('2026-01-01'), dueDate: new Date('2026-02-01') }),
      );

      const service = createService(repo);

      await expect(
        service.updateTask('task-1', { startDate: new Date('2026-03-01') }),
      ).rejects.toThrow(ValidationError);
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // updateTaskStatus — status transitions
  // ────────────────────────────────────────────────────────────────────────
  describe('updateTaskStatus', () => {
    it('allows TODO → IN_PROGRESS, and notifies the assignee (someone else changed their task)', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask({ status: TaskStatus.TODO, assigneeId: 'other-user', title: 'Prepare draft financials' }));
      const updated = createMockTask({ status: TaskStatus.IN_PROGRESS, assigneeId: 'other-user' });
      repo.update.mockResolvedValue(updated);

      const notificationDispatchService = createMockNotificationDispatchService();
      const service = createService(repo, notificationDispatchService);
      const result = await service.updateTaskStatus('task-1', { status: TaskStatus.IN_PROGRESS });

      expect(repo.update).toHaveBeenCalledWith(
        'task-1',
        { status: TaskStatus.IN_PROGRESS },
        { tenantId: TENANT_ID },
      );
      expect(result).toBe(updated);
      expect(notificationDispatchService.send).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        userId: 'other-user',
        title: 'Task status changed',
        message: expect.stringContaining('IN_PROGRESS'),
        channels: [NotificationChannel.IN_APP],
      });
    });

    it('does NOT notify when the caller changes the status of their own assigned task', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask({ status: TaskStatus.TODO, assigneeId: USER_ID }));
      repo.update.mockResolvedValue(createMockTask({ status: TaskStatus.IN_PROGRESS, assigneeId: USER_ID }));

      const notificationDispatchService = createMockNotificationDispatchService();
      const service = createService(repo, notificationDispatchService);
      await service.updateTaskStatus('task-1', { status: TaskStatus.IN_PROGRESS });

      expect(notificationDispatchService.send).not.toHaveBeenCalled();
    });

    it('does NOT notify when the task has no assignee', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask({ status: TaskStatus.TODO, assigneeId: null }));
      repo.update.mockResolvedValue(createMockTask({ status: TaskStatus.IN_PROGRESS, assigneeId: null }));

      const notificationDispatchService = createMockNotificationDispatchService();
      const service = createService(repo, notificationDispatchService);
      await service.updateTaskStatus('task-1', { status: TaskStatus.IN_PROGRESS });

      expect(notificationDispatchService.send).not.toHaveBeenCalled();
    });

    it('throws ConflictError for a transition the state machine does not allow (TODO → COMPLETED)', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask({ status: TaskStatus.TODO }));

      const service = createService(repo);

      await expect(
        service.updateTaskStatus('task-1', { status: TaskStatus.COMPLETED }),
      ).rejects.toThrow(ConflictError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('throws ConflictError when CANCELLED (terminal) is asked to transition anywhere', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask({ status: TaskStatus.CANCELLED }));

      const service = createService(repo);

      await expect(
        service.updateTaskStatus('task-1', { status: TaskStatus.IN_PROGRESS }),
      ).rejects.toThrow(ConflictError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('throws ValidationError when moving to CANCELLED without a reason (validation failure)', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask({ status: TaskStatus.IN_PROGRESS }));

      const service = createService(repo);

      await expect(
        service.updateTaskStatus('task-1', { status: TaskStatus.CANCELLED }),
      ).rejects.toThrow(ValidationError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('allows moving to CANCELLED when a reason is provided', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask({ status: TaskStatus.IN_PROGRESS }));
      repo.update.mockResolvedValue(createMockTask({ status: TaskStatus.CANCELLED }));

      const service = createService(repo);
      const dto: UpdateTaskStatusDto = { status: TaskStatus.CANCELLED, reason: 'No longer needed' };

      await expect(service.updateTaskStatus('task-1', dto)).resolves.toBeDefined();
      expect(repo.update).toHaveBeenCalledWith(
        'task-1',
        { status: TaskStatus.CANCELLED },
        { tenantId: TENANT_ID },
      );
    });

    it('sets completedAt when moving to COMPLETED', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask({ status: TaskStatus.REVIEW }));
      repo.update.mockResolvedValue(createMockTask({ status: TaskStatus.COMPLETED }));

      const service = createService(repo);
      await service.updateTaskStatus('task-1', { status: TaskStatus.COMPLETED });

      expect(repo.update).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({ status: TaskStatus.COMPLETED, completedAt: expect.any(Date) }),
        { tenantId: TENANT_ID },
      );
    });

    it('clears completedAt when reopening (COMPLETED → IN_PROGRESS)', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(
        createMockTask({ status: TaskStatus.COMPLETED, completedAt: new Date('2026-01-05') }),
      );
      repo.update.mockResolvedValue(createMockTask({ status: TaskStatus.IN_PROGRESS, completedAt: null }));

      const service = createService(repo);
      await service.updateTaskStatus('task-1', { status: TaskStatus.IN_PROGRESS });

      expect(repo.update).toHaveBeenCalledWith(
        'task-1',
        { status: TaskStatus.IN_PROGRESS, completedAt: null },
        { tenantId: TENANT_ID },
      );
    });

    it('throws NotFoundError when the task does not exist', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);

      await expect(
        service.updateTaskStatus('missing-id', { status: TaskStatus.IN_PROGRESS }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // deleteTask — delete restrictions
  // ────────────────────────────────────────────────────────────────────────
  describe('deleteTask', () => {
    it('throws NotFoundError when the task does not exist', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.deleteTask('missing-id')).rejects.toThrow(NotFoundError);
    });

    it.each([TaskStatus.IN_PROGRESS, TaskStatus.REVIEW, TaskStatus.COMPLETED])(
      'throws ConflictError when the task status is %s (not deletable)',
      async (status) => {
        const repo = createMockRepository();
        repo.findById.mockResolvedValue(createMockTask({ status }));

        const service = createService(repo);

        await expect(service.deleteTask('task-1')).rejects.toThrow(ConflictError);
        expect(repo.delete).not.toHaveBeenCalled();
      },
    );

    it.each([TaskStatus.TODO, TaskStatus.CANCELLED])(
      'soft-deletes a task in %s status',
      async (status) => {
        const repo = createMockRepository();
        repo.findById.mockResolvedValue(createMockTask({ status }));
        repo.delete.mockResolvedValue(true);

        const service = createService(repo);
        await service.deleteTask('task-1');

        expect(repo.delete).toHaveBeenCalledWith('task-1', { tenantId: TENANT_ID, userId: USER_ID });
      },
    );
  });

  // ────────────────────────────────────────────────────────────────────────
  // restoreTask
  // ────────────────────────────────────────────────────────────────────────
  describe('restoreTask', () => {
    it('throws NotFoundError when the task does not exist at all (including among deleted records)', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.restoreTask('missing-id')).rejects.toThrow(NotFoundError);
      expect(repo.findById).toHaveBeenCalledWith('missing-id', {
        tenantId: TENANT_ID,
        ignoreSoftDelete: true,
      });
    });

    it('throws ConflictError when the task is not deleted', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask({ deletedAt: null }));

      const service = createService(repo);

      await expect(service.restoreTask('task-1')).rejects.toThrow(ConflictError);
      expect(repo.restore).not.toHaveBeenCalled();
    });

    it('restores a soft-deleted task', async () => {
      const repo = createMockRepository();
      const deletedTask = createMockTask({ deletedAt: new Date(), deletedBy: USER_ID });
      const restoredTask = createMockTask({ deletedAt: null, deletedBy: null });

      repo.findById
        .mockResolvedValueOnce(deletedTask) // initial lookup (ignoreSoftDelete: true)
        .mockResolvedValueOnce(restoredTask); // re-fetch after restore
      repo.restore.mockResolvedValue(true);

      const service = createService(repo);
      const result = await service.restoreTask('task-1');

      expect(repo.restore).toHaveBeenCalledWith('task-1', { tenantId: TENANT_ID });
      expect(result).toBe(restoredTask);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // getTaskById
  // ────────────────────────────────────────────────────────────────────────
  describe('getTaskById', () => {
    it('returns the task when found', async () => {
      const repo = createMockRepository();
      const task = createMockTask();
      repo.findById.mockResolvedValue(task);

      const service = createService(repo);
      const result = await service.getTaskById(task.id);

      expect(repo.findById).toHaveBeenCalledWith(task.id, { tenantId: TENANT_ID });
      expect(result).toBe(task);
    });

    it('throws NotFoundError when no task matches the ID', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.getTaskById('missing-id')).rejects.toThrow(NotFoundError);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // listTasks
  // ────────────────────────────────────────────────────────────────────────
  describe('listTasks', () => {
    it('delegates to repository.search with the filters and pagination mapped from the query', async () => {
      const repo = createMockRepository();
      const tasks = [createMockTask(), createMockTask({ id: 'task-2' })];
      const paginated = {
        data: tasks,
        meta: { page: 1, limit: 20, total: 2, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      };
      repo.search.mockResolvedValue(paginated);

      const service = createService(repo);
      const query: ListTasksQueryDto = {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        search: 'financials',
        status: TaskStatus.IN_PROGRESS,
        projectId: 'project-1',
      };

      const result = await service.listTasks(query);

      expect(repo.search).toHaveBeenCalledWith(
        {
          status: TaskStatus.IN_PROGRESS,
          projectId: 'project-1',
          assigneeId: undefined,
          dueBefore: undefined,
          dueAfter: undefined,
          search: 'financials',
        },
        { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
        { tenantId: TENANT_ID },
      );
      expect(result).toBe(paginated);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // getTasksByProject / getTasksByAssignee
  // ────────────────────────────────────────────────────────────────────────
  describe('getTasksByProject', () => {
    it('delegates to repository.findByProject scoped to the tenant', async () => {
      const repo = createMockRepository();
      const tasks = [createMockTask({ projectId: 'project-1' })];
      repo.findByProject.mockResolvedValue(tasks);

      const service = createService(repo);
      const result = await service.getTasksByProject('project-1');

      expect(repo.findByProject).toHaveBeenCalledWith('project-1', { tenantId: TENANT_ID });
      expect(result).toBe(tasks);
    });
  });

  describe('getTasksByAssignee', () => {
    it('delegates to repository.findByAssignee scoped to the tenant', async () => {
      const repo = createMockRepository();
      const tasks = [createMockTask({ assigneeId: 'user-assignee-1' })];
      repo.findByAssignee.mockResolvedValue(tasks);

      const service = createService(repo);
      const result = await service.getTasksByAssignee('user-assignee-1');

      expect(repo.findByAssignee).toHaveBeenCalledWith('user-assignee-1', { tenantId: TENANT_ID });
      expect(result).toBe(tasks);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // getOverdueTasks — overdue logic
  // ────────────────────────────────────────────────────────────────────────
  describe('getOverdueTasks', () => {
    it('delegates to repository.findOverdue scoped to the tenant', async () => {
      const repo = createMockRepository();
      const overdueTasks = [
        createMockTask({ dueDate: new Date('2020-01-01'), status: TaskStatus.IN_PROGRESS }),
      ];
      repo.findOverdue.mockResolvedValue(overdueTasks);

      const service = createService(repo);
      const result = await service.getOverdueTasks();

      expect(repo.findOverdue).toHaveBeenCalledWith({ tenantId: TENANT_ID });
      expect(result).toBe(overdueTasks);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // countByStatus / countByProject
  // ────────────────────────────────────────────────────────────────────────
  describe('countByStatus', () => {
    it('delegates to repository.countByStatus scoped to the tenant', async () => {
      const repo = createMockRepository();
      repo.countByStatus.mockResolvedValue(5);

      const service = createService(repo);
      const result = await service.countByStatus(TaskStatus.TODO);

      expect(repo.countByStatus).toHaveBeenCalledWith(TaskStatus.TODO, { tenantId: TENANT_ID });
      expect(result).toBe(5);
    });
  });

  describe('countByProject', () => {
    it('delegates to repository.countByProject scoped to the tenant', async () => {
      const repo = createMockRepository();
      repo.countByProject.mockResolvedValue(3);

      const service = createService(repo);
      const result = await service.countByProject('project-1');

      expect(repo.countByProject).toHaveBeenCalledWith('project-1', { tenantId: TENANT_ID });
      expect(result).toBe(3);
    });
  });
});
