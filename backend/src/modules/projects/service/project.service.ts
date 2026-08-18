import { Request } from 'express';
import { Project, ProjectStatus, NotificationChannel } from '@prisma/client';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { ConflictError, ValidationError } from '@shared/errors';
import { PaginationMeta } from '@shared/types';
// Concrete path, not the `@modules/notifications` barrel — see
// `middlewares/tenant.middleware.ts`'s header comment for why.
import { NotificationDispatchService } from '@modules/notifications/service/notification-dispatch.service';
import { ProjectRepository } from '../repository/project.repository';
import {
  CreateProjectDto,
  UpdateProjectDto,
  UpdateProjectStatusDto,
  ListProjectsQueryDto,
} from '../dto/project.req.dto';

/**
 * Status transitions reachable through `updateProjectStatus()`.
 * `ARCHIVED` is deliberately excluded — it is only reachable via
 * `archiveProject()`, which enforces the extra "must be COMPLETED" guard.
 * `CANCELLED` has no outgoing transitions (terminal).
 */
const ALLOWED_TRANSITIONS: Partial<Record<ProjectStatus, ProjectStatus[]>> = {
  [ProjectStatus.DRAFT]: [ProjectStatus.PLANNED, ProjectStatus.CANCELLED],
  [ProjectStatus.PLANNED]: [ProjectStatus.ACTIVE, ProjectStatus.CANCELLED],
  [ProjectStatus.ACTIVE]: [ProjectStatus.ON_HOLD, ProjectStatus.COMPLETED, ProjectStatus.CANCELLED],
  [ProjectStatus.ON_HOLD]: [ProjectStatus.ACTIVE, ProjectStatus.CANCELLED],
  [ProjectStatus.COMPLETED]: [ProjectStatus.ACTIVE], // reopen
};

/** Entering these statuses requires an explanatory reason. */
const REASON_REQUIRED_STATUSES: ProjectStatus[] = [ProjectStatus.ON_HOLD, ProjectStatus.CANCELLED];

/** A project may only be soft-deleted while it hasn't started meaningful work. */
const DELETABLE_STATUSES: ProjectStatus[] = [
  ProjectStatus.DRAFT,
  ProjectStatus.PLANNED,
  ProjectStatus.CANCELLED,
];

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Project Service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Business logic for the `Project` (engagement) entity. No HTTP concerns —
 * callers (controllers) pass plain values in and get domain entities back.
 *
 * `this.tenantId`/`this.userId` come from `BaseService` (derived from the
 * authenticated request); every repository call is scoped with them, so
 * tenant isolation and audit stamping happen automatically.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class ProjectService extends BaseService {
  constructor(
    req: Request,
    private readonly projectRepository: ProjectRepository = new ProjectRepository(prisma),
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

  private assertValidTransition(current: ProjectStatus, next: ProjectStatus, reason?: string): void {
    if (next === ProjectStatus.ARCHIVED) {
      throw new ValidationError('Use archiveProject() to archive a completed project.');
    }

    const allowed = ALLOWED_TRANSITIONS[current] ?? [];
    if (!allowed.includes(next)) {
      throw new ConflictError(`Cannot transition project from ${current} to ${next}.`);
    }

    if (REASON_REQUIRED_STATUSES.includes(next) && !reason) {
      throw new ValidationError(`A reason is required to move a project to ${next}.`);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Create / Update
  // ────────────────────────────────────────────────────────────────────────────

  async createProject(dto: CreateProjectDto): Promise<Project> {
    this.assertValidDateRange(dto.startDate, dto.dueDate);

    const existingCode = await this.projectRepository.findByCode(dto.code, {
      tenantId: this.tenantId,
    });
    if (existingCode) {
      throw new ConflictError(`A project with code "${dto.code}" already exists.`);
    }

    this.logger.info({ code: dto.code, clientId: dto.clientId }, 'Creating project');

    // TODO: once ProjectActivity exists, wrap the create + initial activity-log
    // write in this.transaction() so they commit atomically.
    const project = await this.projectRepository.create(
      {
        clientId: dto.clientId,
        managerId: dto.managerId ?? null,
        code: dto.code,
        name: dto.name,
        startDate: dto.startDate ?? null,
        dueDate: dto.dueDate ?? null,
        status: ProjectStatus.DRAFT,
        createdBy: this.userId ?? null,
      },
      { tenantId: this.tenantId },
    );

    if (project.managerId && project.managerId !== this.userId) {
      await this.notify(project.tenantId, project.managerId, 'Project assigned', `You were assigned as manager of project "${project.name}".`);
    }

    return project;
  }

  async updateProject(id: string, dto: UpdateProjectDto): Promise<Project> {
    const existing = await this.projectRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'Project');

    if (existing.status === ProjectStatus.ARCHIVED) {
      throw new ConflictError('Archived projects are read-only and cannot be updated.');
    }

    const nextStartDate = dto.startDate !== undefined ? dto.startDate : existing.startDate;
    const nextDueDate = dto.dueDate !== undefined ? dto.dueDate : existing.dueDate;
    this.assertValidDateRange(nextStartDate, nextDueDate);

    this.logger.info({ projectId: id }, 'Updating project');

    const updated = await this.projectRepository.update(id, dto, { tenantId: this.tenantId });

    // Reassignment only — a genuine change of manager, naturally idempotent
    // (resubmitting the same managerId is a no-op, no duplicate fires).
    const reassigned = dto.managerId !== undefined && dto.managerId !== existing.managerId;
    if (reassigned && updated.managerId && updated.managerId !== this.userId) {
      await this.notify(updated.tenantId, updated.managerId, 'Project assigned', `You were assigned as manager of project "${updated.name}".`);
    }

    return updated;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ────────────────────────────────────────────────────────────────────────────

  async updateProjectStatus(id: string, dto: UpdateProjectStatusDto): Promise<Project> {
    const existing = await this.projectRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'Project');

    if (existing.status === ProjectStatus.ARCHIVED) {
      throw new ConflictError('Archived projects are read-only and cannot change status.');
    }

    this.assertValidTransition(existing.status, dto.status, dto.reason);

    const data: { status: ProjectStatus; completedAt?: Date | null } = { status: dto.status };
    if (dto.status === ProjectStatus.COMPLETED) {
      data.completedAt = new Date();
    } else if (existing.status === ProjectStatus.COMPLETED) {
      // Reopening — clear the previous completion timestamp.
      data.completedAt = null;
    }

    this.logger.info(
      { projectId: id, from: existing.status, to: dto.status },
      'Updating project status',
    );

    // TODO: once ProjectActivity exists, wrap the status update + activity-log
    // write in this.transaction(); once Task/Milestone exist, COMPLETED should
    // also validate no open tasks remain (architecture doc §10, rule 1).
    const updated = await this.projectRepository.update(id, data, { tenantId: this.tenantId });

    if (updated.managerId && updated.managerId !== this.userId) {
      await this.notify(
        updated.tenantId,
        updated.managerId,
        'Project status changed',
        `Project "${existing.name}" status changed to ${dto.status}.`,
      );
    }

    return updated;
  }

  async archiveProject(id: string): Promise<Project> {
    const existing = await this.projectRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'Project');

    if (existing.status !== ProjectStatus.COMPLETED) {
      throw new ConflictError('Only completed projects can be archived.');
    }

    this.logger.info({ projectId: id }, 'Archiving project');

    // TODO: wrap in this.transaction() once archiving needs to cascade
    // (e.g. locking related Tasks/Milestones) once those tables exist.
    const archived = await this.projectRepository.update(
      id,
      { status: ProjectStatus.ARCHIVED, archivedAt: new Date() },
      { tenantId: this.tenantId },
    );

    // TODO: emit ProjectArchived once the domain event bus exists (architecture doc §11).
    return archived;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Soft delete / restore
  // ────────────────────────────────────────────────────────────────────────────

  async deleteProject(id: string): Promise<void> {
    const existing = await this.projectRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'Project');

    if (!DELETABLE_STATUSES.includes(existing.status)) {
      throw new ConflictError('Only draft, planned, or cancelled projects can be deleted.');
    }

    this.logger.info({ projectId: id }, 'Deleting project');

    // TODO: wrap in this.transaction() once deletion needs to cascade to
    // related Tasks (e.g. soft-deleting standalone tasks under this project).
    await this.projectRepository.delete(id, { tenantId: this.tenantId, userId: this.userId });

    // TODO: emit ProjectDeleted once the domain event bus exists (architecture doc §11).
  }

  async restoreProject(id: string): Promise<Project> {
    const existing = await this.projectRepository.findById(id, {
      tenantId: this.tenantId,
      ignoreSoftDelete: true,
    });
    this.validateExists(existing, 'Project');

    if (!existing.deletedAt) {
      throw new ConflictError('Project is not deleted.');
    }

    this.logger.info({ projectId: id }, 'Restoring project');

    await this.projectRepository.restore(id, { tenantId: this.tenantId });

    const restored = await this.projectRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(restored, 'Project');
    return restored;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Reads
  // ────────────────────────────────────────────────────────────────────────────

  async getProjectById(id: string): Promise<Project> {
    const project = await this.projectRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(project, 'Project');
    return project;
  }

  async getProjectByCode(code: string): Promise<Project> {
    const project = await this.projectRepository.findByCode(code, { tenantId: this.tenantId });
    this.validateExists(project, 'Project');
    return project;
  }

  async listProjects(query: ListProjectsQueryDto): Promise<{ data: Project[]; meta: PaginationMeta }> {
    return this.projectRepository.search(
      {
        status: query.status,
        clientId: query.clientId,
        managerId: query.managerId,
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

  async getProjectsByClient(clientId: string): Promise<Project[]> {
    return this.projectRepository.findByClient(clientId, { tenantId: this.tenantId });
  }

  async getProjectsByManager(managerId: string): Promise<Project[]> {
    return this.projectRepository.findMany(
      { managerId },
      { tenantId: this.tenantId },
      undefined,
      { createdAt: 'desc' },
    );
  }

  async getOverdueProjects(): Promise<Project[]> {
    return this.projectRepository.findOverdue({ tenantId: this.tenantId });
  }

  /** IN_APP-only — no PRD text mandates EMAIL/SMS/WhatsApp for project events. Best-effort: never fails the primary action. */
  private async notify(tenantId: string, userId: string, title: string, message: string): Promise<void> {
    try {
      await this.notificationDispatchService.send({ tenantId, userId, title, message, channels: [NotificationChannel.IN_APP] });
    } catch (err) {
      this.logger.warn({ err, userId, title }, 'Failed to dispatch notification');
    }
  }
}
