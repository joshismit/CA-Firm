import { Request } from 'express';
import { Task, TaskStatus, AuditEventType, NotificationChannel } from '@prisma/client';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { ConflictError, ValidationError } from '@shared/errors';
import { PaginationMeta, PaginationQuery } from '@shared/types';
import { AuditLogRecorder } from '@modules/audit';
// Concrete path, not the `@modules/notifications` barrel — see
// `middlewares/tenant.middleware.ts`'s header comment for why.
import { NotificationDispatchService } from '@modules/notifications/service/notification-dispatch.service';
import { TaskRepository, TaskSearchFilters } from '../repository/task.repository';
import {
  CreateTaskDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
  ListTasksQueryDto,
} from '../dto/task.req.dto';

/**
 * Status transitions reachable through `updateTaskStatus()`.
 *
 * Two independent lifecycles share one enum and one flat, status-keyed map —
 * `Task.type` does NOT gate which transitions are legal, only the task's
 * INITIAL status at creation time (`createTask()`: `type` set → REQUESTED,
 * unset → TODO). Once created, whichever family a task started in is the
 * only one reachable, purely because the two families never list each
 * other's statuses as a target below — there is no cross-family edge.
 *
 * Simple flow (unchanged):
 *   TODO → IN_PROGRESS → REVIEW → COMPLETED
 *   TODO/IN_PROGRESS/REVIEW → CANCELLED
 *   REVIEW → IN_PROGRESS (send back)
 *   COMPLETED → IN_PROGRESS (reopen only)
 *
 * Approval workflow (PRD §9):
 *   REQUESTED → SUBMITTED → (UNDER_REVIEW →) APPROVED → COMPLETED
 *   SUBMITTED/UNDER_REVIEW → REJECTED
 *   REQUESTED/SUBMITTED/UNDER_REVIEW → CANCELLED
 *   REJECTED → REQUESTED (reopen/resubmit only)
 *   SUBMITTED → UNDER_REVIEW is an optional "claimed for review" marker —
 *   approve/reject both also accept a task that is still merely SUBMITTED.
 *
 * `CANCELLED` is terminal and shared by both flows. `COMPLETED`'s only
 * outgoing edge is the pre-existing `COMPLETED → IN_PROGRESS` reopen — an
 * approval-workflow task reopened from COMPLETED re-enters the simple flow.
 */
const ALLOWED_TRANSITIONS: Partial<Record<TaskStatus, TaskStatus[]>> = {
  // ── Simple flow ──
  [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.REVIEW, TaskStatus.CANCELLED],
  [TaskStatus.REVIEW]: [TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED, TaskStatus.CANCELLED],

  // ── Approval workflow ──
  [TaskStatus.REQUESTED]: [TaskStatus.SUBMITTED, TaskStatus.CANCELLED],
  [TaskStatus.SUBMITTED]: [
    TaskStatus.UNDER_REVIEW,
    TaskStatus.APPROVED,
    TaskStatus.REJECTED,
    TaskStatus.CANCELLED,
  ],
  [TaskStatus.UNDER_REVIEW]: [TaskStatus.APPROVED, TaskStatus.REJECTED, TaskStatus.CANCELLED],
  [TaskStatus.APPROVED]: [TaskStatus.COMPLETED],
  [TaskStatus.REJECTED]: [TaskStatus.REQUESTED],

  // ── Shared ──
  [TaskStatus.COMPLETED]: [TaskStatus.IN_PROGRESS], // reopen only
  // CANCELLED has no outgoing transitions (terminal).
};

/** Entering these statuses requires an explanatory reason. */
const REASON_REQUIRED_STATUSES: TaskStatus[] = [TaskStatus.CANCELLED, TaskStatus.REJECTED];

/** A task may only be soft-deleted while it hasn't started or has been abandoned. */
const DELETABLE_STATUSES: TaskStatus[] = [
  TaskStatus.TODO,
  TaskStatus.REQUESTED,
  TaskStatus.CANCELLED,
];

/**
 * Resolves the `AuditEventType` for a status transition — dedicated events for
 * the approval-workflow milestones and reopen, `TASK_UPDATE` as the fallback
 * for every other transition (TODO→IN_PROGRESS, IN_PROGRESS→REVIEW,
 * REVIEW→IN_PROGRESS, *→CANCELLED, SUBMITTED→UNDER_REVIEW).
 */
function resolveStatusAuditEvent(from: TaskStatus, to: TaskStatus): AuditEventType {
  if (
    (from === TaskStatus.COMPLETED && to === TaskStatus.IN_PROGRESS) ||
    (from === TaskStatus.REJECTED && to === TaskStatus.REQUESTED)
  ) {
    return AuditEventType.TASK_REOPENED;
  }
  switch (to) {
    case TaskStatus.SUBMITTED:
      return AuditEventType.TASK_SUBMITTED;
    case TaskStatus.APPROVED:
      return AuditEventType.TASK_APPROVED;
    case TaskStatus.REJECTED:
      return AuditEventType.TASK_REJECTED;
    case TaskStatus.COMPLETED:
      return AuditEventType.TASK_COMPLETED;
    default:
      return AuditEventType.TASK_UPDATE;
  }
}

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
    private readonly auditLogRecorder: AuditLogRecorder = new AuditLogRecorder(),
    private readonly notificationDispatchService: NotificationDispatchService = new NotificationDispatchService(),
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

    // PRD §9 — a typed task enters the approval workflow (starts REQUESTED);
    // an untyped task stays on the pre-existing simple flow (starts TODO).
    const initialStatus = dto.type ? TaskStatus.REQUESTED : TaskStatus.TODO;

    this.logger.info({ title: dto.title, projectId: dto.projectId, type: dto.type }, 'Creating task');

    // TODO: once TaskActivity/Comments/TimeLogs/Notifications/Attachments exist,
    // wrap the create + initial activity-log write in this.transaction() so they
    // commit atomically.
    const task = await this.taskRepository.create(
      {
        projectId: dto.projectId ?? null,
        leadId: dto.leadId ?? null,
        assigneeId: dto.assigneeId ?? null,
        businessId: dto.businessId ?? null,
        contactId: dto.contactId ?? null,
        clientId: dto.clientId ?? null,
        documentId: dto.documentId ?? null,
        folderId: dto.folderId ?? null,
        type: dto.type ?? null,
        priority: dto.priority ?? null,
        title: dto.title,
        description: dto.description ?? null,
        startDate: dto.startDate ?? null,
        dueDate: dto.dueDate ?? null,
        status: initialStatus,
        createdBy: this.userId ?? null,
      },
      { tenantId: this.tenantId },
    );

    if (this.userId && this.tenantId) {
      await this.auditLogRecorder.record({
        tenantId: this.tenantId,
        actorId: this.userId,
        eventType: AuditEventType.TASK_CREATED,
        description: `Created task "${task.title}"`,
        targetType: 'Task',
        targetId: task.id,
        ipAddress: this.req.ip ?? null,
      });
    }

    if (task.assigneeId && task.assigneeId !== this.userId) {
      await this.notify(task.tenantId, task.assigneeId, 'Task assigned', `You were assigned the task "${task.title}".`);
    }

    return task;
  }

  async updateTask(id: string, dto: UpdateTaskDto): Promise<Task> {
    const existing = await this.taskRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'Task');

    const nextStartDate = dto.startDate !== undefined ? dto.startDate : existing.startDate;
    const nextDueDate = dto.dueDate !== undefined ? dto.dueDate : existing.dueDate;
    this.assertValidDateRange(nextStartDate, nextDueDate);

    this.logger.info({ taskId: id }, 'Updating task');

    // TODO: once TaskActivity/Comments/TimeLogs/Notifications/Attachments exist,
    // wrap the update + activity-log write in this.transaction() so they commit
    // atomically.
    const updated = await this.taskRepository.update(id, dto, { tenantId: this.tenantId });

    // Reassignment only — a genuine change of assignee, not merely "assigneeId
    // was present in the request body" (naturally idempotent: re-submitting
    // the same assigneeId a second time is a no-op here, no duplicate fires).
    const reassigned = dto.assigneeId !== undefined && dto.assigneeId !== existing.assigneeId;
    if (reassigned) {
      if (this.userId && this.tenantId) {
        await this.auditLogRecorder.record({
          tenantId: this.tenantId,
          actorId: this.userId,
          eventType: AuditEventType.TASK_ASSIGNED,
          description: `Reassigned task "${updated.title}"`,
          targetType: 'Task',
          targetId: updated.id,
          ipAddress: this.req.ip ?? null,
        });
      }
      if (updated.assigneeId && updated.assigneeId !== this.userId) {
        await this.notify(updated.tenantId, updated.assigneeId, 'Task assigned', `You were assigned the task "${updated.title}".`);
      }
    }

    return updated;
  }

  /** PRD §9 — thin, narrowly-permissioned alternative to `updateTask({ assigneeId })`. */
  async assignTask(id: string, assigneeId: string): Promise<Task> {
    return this.updateTask(id, { assigneeId });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ────────────────────────────────────────────────────────────────────────────

  async updateTaskStatus(id: string, dto: UpdateTaskStatusDto): Promise<Task> {
    const existing = await this.taskRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'Task');

    this.assertValidTransition(existing.status, dto.status, dto.reason);

    const data: {
      status: TaskStatus;
      completedAt?: Date | null;
      completedBy?: string | null;
      approvedBy?: string;
      rejectedBy?: string;
    } = { status: dto.status };

    if (dto.status === TaskStatus.COMPLETED) {
      // Moving to terminal COMPLETED — stamp the timestamp and actor.
      data.completedAt = new Date();
      data.completedBy = this.userId ?? null;
    } else if (existing.status === TaskStatus.COMPLETED) {
      // Reopening from COMPLETED — clear the previous completion stamp.
      data.completedAt = null;
      data.completedBy = null;
    }

    if (dto.status === TaskStatus.APPROVED && this.userId) {
      data.approvedBy = this.userId;
    } else if (dto.status === TaskStatus.REJECTED && this.userId) {
      data.rejectedBy = this.userId;
    }

    this.logger.info(
      { taskId: id, from: existing.status, to: dto.status },
      'Updating task status',
    );

    // TODO: once TaskActivity/Comments/TimeLogs/Notifications/Attachments exist,
    // wrap the status update + activity-log write in this.transaction(); once
    // TaskDependency exists, IN_PROGRESS should also validate no incomplete
    // blocking predecessor.
    const updated = await this.taskRepository.update(id, data, { tenantId: this.tenantId });

    await this.auditLogRecorder.record({
      tenantId: this.tenantId as string,
      actorId: this.userId as string,
      eventType: resolveStatusAuditEvent(existing.status, dto.status),
      description: `Changed task "${existing.title}" status from ${existing.status} to ${dto.status}`,
      targetType: 'Task',
      targetId: id,
      ipAddress: this.req.ip ?? null,
    });

    // PRD §8.7/§8.11 — a CRM follow-up (a Task linked to a Lead) was completed.
    if (updated.leadId && dto.status === TaskStatus.COMPLETED && this.userId && this.tenantId) {
      await this.auditLogRecorder.record({
        tenantId: this.tenantId,
        actorId: this.userId,
        eventType: AuditEventType.FOLLOWUP_COMPLETED,
        description: `Completed follow-up "${existing.title}"`,
        targetType: 'Lead',
        targetId: updated.leadId,
        ipAddress: this.req.ip ?? null,
      });
    }

    if (updated.assigneeId && updated.assigneeId !== this.userId) {
      const { title, message } = this.statusChangeNotificationCopy(existing.title, dto.status, dto.reason);
      await this.notify(updated.tenantId, updated.assigneeId, title, message);
    }

    return updated;
  }

  /** PRD §9 — distinct notification copy for the approval-workflow milestones; generic fallback otherwise. */
  private statusChangeNotificationCopy(
    taskTitle: string,
    status: TaskStatus,
    reason?: string,
  ): { title: string; message: string } {
    switch (status) {
      case TaskStatus.SUBMITTED:
        return { title: 'Task submitted', message: `Task "${taskTitle}" was submitted for review.` };
      case TaskStatus.APPROVED:
        return { title: 'Task approved', message: `Task "${taskTitle}" was approved.` };
      case TaskStatus.REJECTED:
        return { title: 'Task rejected', message: `Task "${taskTitle}" was rejected: ${reason}.` };
      default:
        return { title: 'Task status changed', message: `Task "${taskTitle}" status changed to ${status}.` };
    }
  }

  /** PRD §9 — REQUESTED → SUBMITTED: hand a task off for review. */
  async submitTask(id: string): Promise<Task> {
    return this.updateTaskStatus(id, { status: TaskStatus.SUBMITTED });
  }

  /** PRD §9 — reviewer decision: (SUBMITTED|UNDER_REVIEW) → APPROVED. */
  async approveTask(id: string): Promise<Task> {
    return this.updateTaskStatus(id, { status: TaskStatus.APPROVED });
  }

  /** PRD §9 — reviewer decision: (SUBMITTED|UNDER_REVIEW) → REJECTED. `reason` is required. */
  async rejectTask(id: string, reason: string): Promise<Task> {
    return this.updateTaskStatus(id, { status: TaskStatus.REJECTED, reason });
  }

  /** PRD §9 — REVIEW → COMPLETED (simple flow) or APPROVED → COMPLETED (approval workflow). */
  async completeTask(id: string): Promise<Task> {
    return this.updateTaskStatus(id, { status: TaskStatus.COMPLETED });
  }

  /** PRD §9 — reopen a terminal/near-terminal task: COMPLETED→IN_PROGRESS or REJECTED→REQUESTED. */
  async reopenTask(id: string): Promise<Task> {
    const existing = await this.taskRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'Task');

    if (existing.status === TaskStatus.COMPLETED) {
      return this.updateTaskStatus(id, { status: TaskStatus.IN_PROGRESS });
    }
    if (existing.status === TaskStatus.REJECTED) {
      return this.updateTaskStatus(id, { status: TaskStatus.REQUESTED });
    }
    throw new ConflictError(`Cannot reopen a task in ${existing.status} status.`);
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

  async deleteTask(id: string): Promise<void> {
    const existing = await this.taskRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'Task');

    if (!DELETABLE_STATUSES.includes(existing.status)) {
      throw new ConflictError(
        `Cannot delete a task in ${existing.status} status. ` +
        'Only TODO, REQUESTED, or CANCELLED tasks can be deleted.',
      );
    }

    this.logger.info({ taskId: id }, 'Deleting task');

    // TODO: once TaskActivity/Comments/TimeLogs/Notifications/Attachments exist,
    // wrap the delete + cascade writes in this.transaction() so they commit
    // atomically.
    await this.taskRepository.delete(id, { tenantId: this.tenantId, userId: this.userId });

    // TODO: emit TaskDeleted once the domain event bus exists.
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
        leadId: query.leadId,
        assigneeId: query.assigneeId,
        type: query.type,
        priority: query.priority,
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

  /** PRD §8.7 — follow-up tasks linked to a CRM Lead. */
  async getTasksByLead(leadId: string): Promise<Task[]> {
    return this.taskRepository.findByLead(leadId, { tenantId: this.tenantId });
  }

  async getTasksByAssignee(assigneeId: string): Promise<Task[]> {
    return this.taskRepository.findByAssignee(assigneeId, { tenantId: this.tenantId });
  }

  async getOverdueTasks(): Promise<Task[]> {
    return this.taskRepository.findOverdue({ tenantId: this.tenantId });
  }

  /** PRD §9 — tasks awaiting a reviewer's decision (SUBMITTED or UNDER_REVIEW). */
  async getPendingReviewTasks(): Promise<Task[]> {
    return this.taskRepository.findPendingReview({ tenantId: this.tenantId });
  }

  async countByStatus(status: TaskStatus): Promise<number> {
    return this.taskRepository.countByStatus(status, { tenantId: this.tenantId });
  }

  async countByProject(projectId: string): Promise<number> {
    return this.taskRepository.countByProject(projectId, { tenantId: this.tenantId });
  }

  /**
   * PRD §10.5 — thin, tenant-scoped passthrough to `TaskRepository.search()` for the
   * Dashboard's "Pending Works"/"Due Dates" widgets (`DashboardAggregationService`
   * composes via this Service, never the repository directly — see that module's
   * header comment on why every cross-module read goes through a Service).
   */
  async searchForDashboard(
    filters: TaskSearchFilters,
    pagination: PaginationQuery,
  ): Promise<{ data: Task[]; meta: PaginationMeta }> {
    return this.taskRepository.search(filters, pagination, { tenantId: this.tenantId });
  }

  /**
   * "Upcoming Follow-ups" CRM dashboard stat (PRD §8.10) — open, lead-linked
   * follow-up tasks due within the next 30 days. Composed by
   * `LeadService.getDashboardStats()` via `new TaskService(this.req)`, the
   * same cross-module composition style `LeadService` already uses for
   * `BusinessService`.
   */
  async countUpcomingLeadFollowUps(): Promise<number> {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return this.taskRepository.countUpcomingLeadFollowUps({ gte: now, lte: in30Days }, { tenantId: this.tenantId });
  }

  /** IN_APP-only — no PRD text mandates EMAIL/SMS/WhatsApp for task events. Best-effort: never fails the primary action. */
  private async notify(tenantId: string, userId: string, title: string, message: string): Promise<void> {
    try {
      await this.notificationDispatchService.send({ tenantId, userId, title, message, channels: [NotificationChannel.IN_APP] });
    } catch (err) {
      this.logger.warn({ err, userId, title }, 'Failed to dispatch notification');
    }
  }
}
