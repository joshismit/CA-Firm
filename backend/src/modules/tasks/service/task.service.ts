import { Request } from 'express';
import { Task, TaskStatus } from '@prisma/client';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { ConflictError, ValidationError } from '@shared/errors';
import { PaginationMeta } from '@shared/types';
import { TaskRepository } from '../repository/task.repository';
import {
  CreateTaskDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
  ListTasksQueryDto,
} from '../dto/task.req.dto';

/**
 * Status transitions reachable through `updateTaskStatus()`.
 * There is no ARCHIVED status for tasks (unlike Project) — "archived tasks
 * don't exist" is a deliberate business rule, not an omission.
 * `CANCELLED` has no outgoing transitions (terminal).
 */
const ALLOWED_TRANSITIONS: Partial<Record<TaskStatus, TaskStatus[]>> = {
  [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.REVIEW, TaskStatus.COMPLETED, TaskStatus.CANCELLED],
  [TaskStatus.REVIEW]: [TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED, TaskStatus.CANCELLED],
  [TaskStatus.COMPLETED]: [TaskStatus.IN_PROGRESS], // reopen
};

/** Entering these statuses requires an explanatory reason. */
const REASON_REQUIRED_STATUSES: TaskStatus[] = [TaskStatus.CANCELLED];

/** A task may only be soft-deleted while it hasn't started or has been abandoned. */
const DELETABLE_STATUSES: TaskStatus[] = [TaskStatus.TODO, TaskStatus.CANCELLED];

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Task Service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Business logic for the `Task` entity. No HTTP concerns — callers
 * (controllers) pass plain values in and get domain entities back. Mirrors
 * `modules/projects/service/project.service.ts` exactly.
 *
 * `this.tenantId`/`this.userId` come from `BaseService` (derived from the
 * authenticated request); every repository call is scoped with them, so
 * tenant isolation and audit stamping happen automatically.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class TaskService extends BaseService {
  constructor(
    req: Request,
    private readonly taskRepository: TaskRepository = new TaskRepository(prisma),
  ) {
    super(req);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Internal guards
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Cross-field validation the Zod layer can't express (see schema file for why).
   */
  private assertValidDateRange(startDate?: Date | null, dueDate?: Date | null): void {
    if (startDate && dueDate && dueDate.getTime() < startDate.getTime()) {
      throw new ValidationError('dueDate cannot be before startDate.');
    }
  }

  private assertValidTransition(current: TaskStatus, next: TaskStatus, reason?: string): void {
    const allowed = ALLOWED_TRANSITIONS[current] ?? [];
    if (!allowed.includes(next)) {
      throw new ConflictError(`Cannot transition task from ${current} to ${next}.`);
    }

    if (REASON_REQUIRED_STATUSES.includes(next) && !reason) {
      throw new ValidationError(`A reason is required to move a task to ${next}.`);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Create / Update
  // ────────────────────────────────────────────────────────────────────────────

  async createTask(dto: CreateTaskDto): Promise<Task> {
    this.assertValidDateRange(dto.startDate, dto.dueDate);

    this.logger.info({ title: dto.title, projectId: dto.projectId }, 'Creating task');

    // TODO: once TaskActivity/labels exist, wrap the create + initial
    // activity-log write in this.transaction() so they commit atomically.
    const task = await this.taskRepository.create(
      {
        projectId: dto.projectId ?? null,
        assigneeId: dto.assigneeId ?? null,
        title: dto.title,
        description: dto.description ?? null,
        startDate: dto.startDate ?? null,
        dueDate: dto.dueDate ?? null,
        status: TaskStatus.TODO,
        createdBy: this.userId ?? null,
      },
      { tenantId: this.tenantId },
    );

    // TODO: emit TaskCreated once the domain event bus exists.
    return task;
  }

  async updateTask(id: string, dto: UpdateTaskDto): Promise<Task> {
    const existing = await this.taskRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'Task');

    const nextStartDate = dto.startDate !== undefined ? dto.startDate : existing.startDate;
    const nextDueDate = dto.dueDate !== undefined ? dto.dueDate : existing.dueDate;
    this.assertValidDateRange(nextStartDate, nextDueDate);

    this.logger.info({ taskId: id }, 'Updating task');

    return this.taskRepository.update(id, dto, { tenantId: this.tenantId });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ────────────────────────────────────────────────────────────────────────────

  async updateTaskStatus(id: string, dto: UpdateTaskStatusDto): Promise<Task> {
    const existing = await this.taskRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'Task');

    this.assertValidTransition(existing.status, dto.status, dto.reason);

    const data: { status: TaskStatus; completedAt?: Date | null } = { status: dto.status };
    if (dto.status === TaskStatus.COMPLETED) {
      data.completedAt = new Date();
    } else if (existing.status === TaskStatus.COMPLETED) {
      // Reopening — clear the previous completion timestamp.
      data.completedAt = null;
    }

    this.logger.info(
      { taskId: id, from: existing.status, to: dto.status },
      'Updating task status',
    );

    // TODO: once TaskActivity exists, wrap the status update + activity-log
    // write in this.transaction(); once TaskDependency exists, IN_PROGRESS
    // should also validate no incomplete blocking predecessor.
    const updated = await this.taskRepository.update(id, data, { tenantId: this.tenantId });

    // TODO: emit TaskStatusChanged (and TaskCompleted/TaskReopened where
    // applicable) once the domain event bus exists.
    return updated;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Soft delete / restore
  // ────────────────────────────────────────────────────────────────────────────

  async deleteTask(id: string): Promise<void> {
    const existing = await this.taskRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'Task');

    if (!DELETABLE_STATUSES.includes(existing.status)) {
      throw new ConflictError('Only TODO or cancelled tasks can be deleted.');
    }

    this.logger.info({ taskId: id }, 'Deleting task');

    // TODO: wrap in this.transaction() once deletion needs to cascade to
    // related subtasks/attachments/comments.
    await this.taskRepository.delete(id, { tenantId: this.tenantId, userId: this.userId });

    // TODO: emit TaskDeleted once the domain event bus exists.
  }

  async restoreTask(id: string): Promise<Task> {
    const existing = await this.taskRepository.findById(id, {
      tenantId: this.tenantId,
      ignoreSoftDelete: true,
    });
    this.validateExists(existing, 'Task');

    if (!existing.deletedAt) {
      throw new ConflictError('Task is not deleted.');
    }

    this.logger.info({ taskId: id }, 'Restoring task');

    await this.taskRepository.restore(id, { tenantId: this.tenantId });

    const restored = await this.taskRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(restored, 'Task');
    return restored;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Reads
  // ────────────────────────────────────────────────────────────────────────────

  async getTaskById(id: string): Promise<Task> {
    const task = await this.taskRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(task, 'Task');
    return task;
  }

  async listTasks(query: ListTasksQueryDto): Promise<{ data: Task[]; meta: PaginationMeta }> {
    return this.taskRepository.search(
      {
        status: query.status,
        projectId: query.projectId,
        assigneeId: query.assigneeId,
        dueBefore: query.dueBefore,
        dueAfter: query.dueAfter,
        search: query.search,
      },
      {
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
      { tenantId: this.tenantId },
    );
  }

  async getTasksByProject(projectId: string): Promise<Task[]> {
    return this.taskRepository.findByProject(projectId, { tenantId: this.tenantId });
  }

  async getTasksByAssignee(assigneeId: string): Promise<Task[]> {
    return this.taskRepository.findByAssignee(assigneeId, { tenantId: this.tenantId });
  }

  async getOverdueTasks(): Promise<Task[]> {
    return this.taskRepository.findOverdue({ tenantId: this.tenantId });
  }

  async countByStatus(status: TaskStatus): Promise<number> {
    return this.taskRepository.countByStatus(status, { tenantId: this.tenantId });
  }

  async countByProject(projectId: string): Promise<number> {
    return this.taskRepository.countByProject(projectId, { tenantId: this.tenantId });
  }
}
