import { Request } from 'express';
import { Task, TaskStatus } from '@prisma/client';
import { UserRole } from '@shared/enums';

/**
 * `TaskService`'s constructor defaults to `new TaskRepository(prisma)` (the
 * real `@config/database` singleton) when no repository is injected. These
 * tests always inject an explicit mock repository, so the real `prisma`
 * export is never used — but merely *importing* `TaskService` transitively
 * imports `@config/database`, whose top-level `new PrismaClient(...)` call
 * opens a real connection pool that this file never disconnects, leaving the
 * Jest process hanging after all tests complete. Stubbing the module here is
 * test-only and does not touch production code. Mirrors
 * `tests/unit/modules/tasks/task.service.spec.ts`.
 */
jest.mock('@config/database', () => ({ prisma: {} }));

import { TaskService } from '@modules/tasks/service/task.service';
import { TaskRepository } from '@modules/tasks/repository/task.repository';
import { ListTasksQueryDto } from '@modules/tasks/dto/task.req.dto';
import { ValidationError, ConflictError, NotFoundError } from '@shared/errors';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TaskService Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Mocks ONLY `TaskRepository` to test pure business logic, status state machine,
 * cross-field date validations, soft-delete rules, and error handling.
 * ─────────────────────────────────────────────────────────────────────────────
 */

describe('TaskService', () => {
  let service: TaskService;
  let mockTaskRepository: jest.Mocked<Partial<TaskRepository>>;

  const tenantId = 'tenant-uuid-1111';
  const userId = 'user-uuid-2222';

  const mockReq = {
    tenant: { id: tenantId },
    user: { id: userId, role: UserRole.TENANT_ADMIN, tenantId, permissions: [] },
  } as unknown as Request;

  const sampleTask: Task = {
    id: 'task-uuid-9999',
    tenantId,
    projectId: 'project-uuid-8888',
    leadId: null,
    assigneeId: userId,
    title: 'Review Tax Audits',
    description: 'Perform detailed verification',
    status: TaskStatus.TODO,
    type: null,
    priority: null,
    businessId: null,
    contactId: null,
    clientId: null,
    documentId: null,
    folderId: null,
    startDate: new Date('2026-06-01'),
    dueDate: new Date('2026-06-30'),
    completedAt: null,
    completedBy: null,
    approvedBy: null,
    rejectedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy: userId,
    deletedBy: null,
  };

  beforeEach(() => {
    mockTaskRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      restore: jest.fn(),
      search: jest.fn(),
      findByProject: jest.fn(),
      findByAssignee: jest.fn(),
      findOverdue: jest.fn(),
    };

    service = new TaskService(mockReq, mockTaskRepository as unknown as TaskRepository);
  });

  // ─── 1. createTask() ─────────────────────────────────────────────────────────

  describe('createTask()', () => {
    it('should create a task when input parameters and dates are valid', async () => {
      const dto = {
        title: 'New Audit Task',
        description: 'Audit preparation',
        startDate: new Date('2026-06-01'),
        dueDate: new Date('2026-06-15'),
      };

      (mockTaskRepository.create as jest.Mock).mockResolvedValue({
        ...sampleTask,
        title: dto.title,
      });

      const result = await service.createTask(dto);

      expect(result.title).toBe(dto.title);
      expect(mockTaskRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: dto.title,
          status: TaskStatus.TODO,
          createdBy: userId,
        }),
        { tenantId },
      );
    });

    it('should throw ValidationError if dueDate is before startDate', async () => {
      const invalidDto = {
        title: 'Invalid Dates Task',
        startDate: new Date('2026-06-20'),
        dueDate: new Date('2026-06-10'), // Due before start
      };

      await expect(service.createTask(invalidDto)).rejects.toThrow(ValidationError);
      await expect(service.createTask(invalidDto)).rejects.toThrow(
        'dueDate cannot be before startDate.',
      );
      expect(mockTaskRepository.create).not.toHaveBeenCalled();
    });
  });

  // ─── 2. updateTask() ─────────────────────────────────────────────────────────

  describe('updateTask()', () => {
    it('should update task details when valid', async () => {
      (mockTaskRepository.findById as jest.Mock).mockResolvedValue(sampleTask);
      (mockTaskRepository.update as jest.Mock).mockResolvedValue({
        ...sampleTask,
        title: 'Updated Title',
      });

      const result = await service.updateTask(sampleTask.id, { title: 'Updated Title' });

      expect(result.title).toBe('Updated Title');
      expect(mockTaskRepository.update).toHaveBeenCalledWith(
        sampleTask.id,
        { title: 'Updated Title' },
        { tenantId },
      );
    });

    it('should throw NotFoundError if task to update does not exist', async () => {
      (mockTaskRepository.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.updateTask('non-existent-id', { title: 'Test' })).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should throw ValidationError if updated dueDate is before existing startDate', async () => {
      (mockTaskRepository.findById as jest.Mock).mockResolvedValue({
        ...sampleTask,
        startDate: new Date('2026-06-15'),
      });

      await expect(
        service.updateTask(sampleTask.id, { dueDate: new Date('2026-06-01') }),
      ).rejects.toThrow(ValidationError);
    });
  });

  // ─── 3. updateTaskStatus() & Lifecycle Transitions ────────────────────────────

  describe('updateTaskStatus()', () => {
    it('should allow valid transition TODO -> IN_PROGRESS', async () => {
      (mockTaskRepository.findById as jest.Mock).mockResolvedValue({
        ...sampleTask,
        status: TaskStatus.TODO,
      });
      (mockTaskRepository.update as jest.Mock).mockResolvedValue({
        ...sampleTask,
        status: TaskStatus.IN_PROGRESS,
      });

      const updated = await service.updateTaskStatus(sampleTask.id, {
        status: TaskStatus.IN_PROGRESS,
      });

      expect(updated.status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should allow valid transition IN_PROGRESS -> REVIEW', async () => {
      (mockTaskRepository.findById as jest.Mock).mockResolvedValue({
        ...sampleTask,
        status: TaskStatus.IN_PROGRESS,
      });
      (mockTaskRepository.update as jest.Mock).mockResolvedValue({
        ...sampleTask,
        status: TaskStatus.REVIEW,
      });

      const updated = await service.updateTaskStatus(sampleTask.id, {
        status: TaskStatus.REVIEW,
      });

      expect(updated.status).toBe(TaskStatus.REVIEW);
    });

    it('should set completedAt when transitioning REVIEW -> COMPLETED', async () => {
      (mockTaskRepository.findById as jest.Mock).mockResolvedValue({
        ...sampleTask,
        status: TaskStatus.REVIEW,
      });
      (mockTaskRepository.update as jest.Mock).mockImplementation(async (id, data) => ({
        ...sampleTask,
        ...data,
      }));

      await service.updateTaskStatus(sampleTask.id, { status: TaskStatus.COMPLETED });

      expect(mockTaskRepository.update).toHaveBeenCalledWith(
        sampleTask.id,
        expect.objectContaining({
          status: TaskStatus.COMPLETED,
          completedAt: expect.any(Date),
        }),
        { tenantId },
      );
    });

    it('should clear completedAt timestamp when reopening COMPLETED -> IN_PROGRESS', async () => {
      (mockTaskRepository.findById as jest.Mock).mockResolvedValue({
        ...sampleTask,
        status: TaskStatus.COMPLETED,
        completedAt: new Date(),
      });
      (mockTaskRepository.update as jest.Mock).mockImplementation(async (id, data) => ({
        ...sampleTask,
        ...data,
      }));

      await service.updateTaskStatus(sampleTask.id, { status: TaskStatus.IN_PROGRESS });

      expect(mockTaskRepository.update).toHaveBeenCalledWith(
        sampleTask.id,
        expect.objectContaining({
          status: TaskStatus.IN_PROGRESS,
          completedAt: null,
        }),
        { tenantId },
      );
    });

    it('should require a reason when moving to CANCELLED', async () => {
      (mockTaskRepository.findById as jest.Mock).mockResolvedValue({
        ...sampleTask,
        status: TaskStatus.TODO,
      });

      // Without reason -> ValidationError
      await expect(
        service.updateTaskStatus(sampleTask.id, { status: TaskStatus.CANCELLED }),
      ).rejects.toThrow(ValidationError);

      // With reason -> Success
      (mockTaskRepository.update as jest.Mock).mockResolvedValue({
        ...sampleTask,
        status: TaskStatus.CANCELLED,
      });

      const cancelled = await service.updateTaskStatus(sampleTask.id, {
        status: TaskStatus.CANCELLED,
        reason: 'Client cancelled engagement',
      });
      expect(cancelled.status).toBe(TaskStatus.CANCELLED);
    });

    it('should reject invalid transition TODO -> COMPLETED (must pass through IN_PROGRESS and REVIEW)', async () => {
      (mockTaskRepository.findById as jest.Mock).mockResolvedValue({
        ...sampleTask,
        status: TaskStatus.TODO,
      });

      await expect(
        service.updateTaskStatus(sampleTask.id, { status: TaskStatus.COMPLETED }),
      ).rejects.toThrow(ConflictError);
    });

    it('should reject invalid transition IN_PROGRESS -> COMPLETED (must pass through REVIEW)', async () => {
      (mockTaskRepository.findById as jest.Mock).mockResolvedValue({
        ...sampleTask,
        status: TaskStatus.IN_PROGRESS,
      });

      await expect(
        service.updateTaskStatus(sampleTask.id, { status: TaskStatus.COMPLETED }),
      ).rejects.toThrow(ConflictError);
    });
  });

  // ─── 4. deleteTask() ─────────────────────────────────────────────────────────

  describe('deleteTask()', () => {
    it('should allow soft deleting a task in TODO status', async () => {
      (mockTaskRepository.findById as jest.Mock).mockResolvedValue({
        ...sampleTask,
        status: TaskStatus.TODO,
      });
      (mockTaskRepository.delete as jest.Mock).mockResolvedValue(undefined);

      await service.deleteTask(sampleTask.id);

      expect(mockTaskRepository.delete).toHaveBeenCalledWith(sampleTask.id, { tenantId, userId });
    });

    it('should allow soft deleting a task in CANCELLED status', async () => {
      (mockTaskRepository.findById as jest.Mock).mockResolvedValue({
        ...sampleTask,
        status: TaskStatus.CANCELLED,
      });
      (mockTaskRepository.delete as jest.Mock).mockResolvedValue(undefined);

      await service.deleteTask(sampleTask.id);

      expect(mockTaskRepository.delete).toHaveBeenCalledWith(sampleTask.id, { tenantId, userId });
    });

    it('should reject deleting tasks in IN_PROGRESS status', async () => {
      (mockTaskRepository.findById as jest.Mock).mockResolvedValue({
        ...sampleTask,
        status: TaskStatus.IN_PROGRESS,
      });

      await expect(service.deleteTask(sampleTask.id)).rejects.toThrow(ConflictError);
      expect(mockTaskRepository.delete).not.toHaveBeenCalled();
    });

    it('should reject deleting tasks in REVIEW status', async () => {
      (mockTaskRepository.findById as jest.Mock).mockResolvedValue({
        ...sampleTask,
        status: TaskStatus.REVIEW,
      });

      await expect(service.deleteTask(sampleTask.id)).rejects.toThrow(ConflictError);
      expect(mockTaskRepository.delete).not.toHaveBeenCalled();
    });

    it('should reject deleting tasks in COMPLETED status', async () => {
      (mockTaskRepository.findById as jest.Mock).mockResolvedValue({
        ...sampleTask,
        status: TaskStatus.COMPLETED,
      });

      await expect(service.deleteTask(sampleTask.id)).rejects.toThrow(ConflictError);
      expect(mockTaskRepository.delete).not.toHaveBeenCalled();
    });
  });

  // ─── 5. restoreTask() ────────────────────────────────────────────────────────

  describe('restoreTask()', () => {
    it('should restore a soft-deleted task', async () => {
      const deletedTask = { ...sampleTask, deletedAt: new Date() };
      const restoredTask = { ...sampleTask, deletedAt: null };

      (mockTaskRepository.findById as jest.Mock)
        .mockResolvedValueOnce(deletedTask) // Check deleted status
        .mockResolvedValueOnce(restoredTask); // Post-restore fetch

      (mockTaskRepository.restore as jest.Mock).mockResolvedValue(undefined);

      const result = await service.restoreTask(sampleTask.id);

      expect(result.deletedAt).toBeNull();
      expect(mockTaskRepository.restore).toHaveBeenCalledWith(sampleTask.id, { tenantId });
    });

    it('should throw ConflictError if task is not soft-deleted', async () => {
      (mockTaskRepository.findById as jest.Mock).mockResolvedValue({
        ...sampleTask,
        deletedAt: null,
      });

      await expect(service.restoreTask(sampleTask.id)).rejects.toThrow(ConflictError);
      await expect(service.restoreTask(sampleTask.id)).rejects.toThrow('Task is not deleted.');
      expect(mockTaskRepository.restore).not.toHaveBeenCalled();
    });
  });

  // ─── 6. getTaskById() ────────────────────────────────────────────────────────

  describe('getTaskById()', () => {
    it('should return task if found', async () => {
      (mockTaskRepository.findById as jest.Mock).mockResolvedValue(sampleTask);

      const task = await service.getTaskById(sampleTask.id);

      expect(task).toEqual(sampleTask);
      expect(mockTaskRepository.findById).toHaveBeenCalledWith(sampleTask.id, { tenantId });
    });

    it('should throw NotFoundError if task is not found', async () => {
      (mockTaskRepository.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.getTaskById('unknown-id')).rejects.toThrow(NotFoundError);
    });
  });

  // ─── 7. listTasks() ──────────────────────────────────────────────────────────

  describe('listTasks()', () => {
    it('should delegate search parameters to repository', async () => {
      const mockResult = {
        data: [sampleTask],
        meta: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };

      (mockTaskRepository.search as jest.Mock).mockResolvedValue(mockResult);

      const query: ListTasksQueryDto = {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        status: TaskStatus.TODO,
      };
      const res = await service.listTasks(query);

      expect(res).toEqual(mockResult);
      expect(mockTaskRepository.search).toHaveBeenCalledWith(
        expect.objectContaining({ status: TaskStatus.TODO }),
        expect.objectContaining({ page: 1, limit: 20 }),
        { tenantId },
        {},
      );
    });
  });
});
