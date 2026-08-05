import { PrismaClient, Prisma, Task, TaskStatus } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';
import { PaginationQuery, PaginationMeta } from '@shared/types';

/**
 * Domain-shaped search criteria for `TaskRepository.search()`.
 * Deliberately Prisma-agnostic — the repository is responsible for
 * translating this into a `Prisma.TaskWhereInput`, so callers (the future
 * service layer) never need to import Prisma query-builder types. Mirrors
 * `ProjectSearchFilters` in `modules/projects/repository/project.repository.ts`.
 *
 * TODO: once labels exist, add `labelId?: string` here (join via a future
 * TaskLabelAssignment table).
 * TODO: once dependencies exist, consider a `blockedOnly?: boolean` filter
 * (tasks with an incomplete predecessor).
 * TODO: once milestones exist, add `milestoneId?: string`.
 */
export interface TaskSearchFilters {
  status?: TaskStatus;
  projectId?: string;
  assigneeId?: string;
  dueBefore?: Date;
  dueAfter?: Date;
  /** Matches against `title` or `description` (case-insensitive). */
  search?: string;
}

/** Statuses that no longer count as "open"/overdue-eligible work. */
const TERMINAL_STATUSES: TaskStatus[] = [TaskStatus.COMPLETED, TaskStatus.CANCELLED];

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Task Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Data access for the `Task` entity only. Inherits tenant scoping, soft
 * delete, and standard CRUD/pagination from `BaseRepository`; adds only the
 * finder/count methods specific to tasks. No business logic, no validation,
 * no transactions, no event publishing — those belong to the future
 * `TaskService`.
 *
 * TODO: once subtasks are modeled (`parentTaskId`), add `findSubtasks(taskId)`.
 * TODO: once TaskDependency exists, add `findBlocking(taskId)` /
 * `findBlockedBy(taskId)` for dependency-aware transitions.
 * TODO: once TaskLabelAssignment exists, add `findByLabel(labelId)`.
 * TODO: once milestones exist, add `findByMilestone(milestoneId)`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class TaskRepository extends BaseRepository<Prisma.TaskDelegate, Task> {
  constructor(prisma: PrismaClient) {
    super(prisma.task, prisma);
  }

  /**
   * Finds all tasks in one of the given statuses.
   */
  async findByStatus(statuses: TaskStatus[], options: RepositoryOptions = {}): Promise<Task[]> {
    return this.findMany({ status: { in: statuses } }, options);
  }

  /**
   * Finds all tasks belonging to a given project, newest first.
   */
  async findByProject(projectId: string, options: RepositoryOptions = {}): Promise<Task[]> {
    return this.findMany({ projectId }, options, undefined, { createdAt: 'desc' });
  }

  /**
   * Finds all tasks assigned to a given user, newest first.
   */
  async findByAssignee(assigneeId: string, options: RepositoryOptions = {}): Promise<Task[]> {
    return this.findMany({ assigneeId }, options, undefined, { createdAt: 'desc' });
  }

  /**
   * Finds open (non-terminal) tasks whose due date has passed.
   */
  async findOverdue(options: RepositoryOptions = {}): Promise<Task[]> {
    return this.findMany(
      {
        dueDate: { lt: new Date() },
        status: { notIn: TERMINAL_STATUSES },
      },
      options,
      undefined,
      { dueDate: 'asc' },
    );
  }

  /**
   * Tasks eligible for a `TaskReminder` (PRD §4.2): open (non-terminal) status,
   * has an assignee (there's nobody to remind otherwise), and `dueDate` falls
   * within the caller's range. Deliberately unscoped by default — the
   * reminder scan runs once across every tenant, not per-tenant, so
   * `TaskReminderService` always passes `{ ignoreTenant: true }` here (the
   * same escape hatch `MasterAdminAuditService` uses for the same reason).
   * `dueDateRange` is a plain `[gte, lt)` pair rather than a `Prisma.DateTimeFilter`
   * so this method's signature stays Prisma-agnostic, matching every other
   * method on this repository.
   */
  async findReminderCandidates(dueDateRange: { gte?: Date; lt?: Date }, options: RepositoryOptions = {}): Promise<Task[]> {
    return this.findMany(
      {
        dueDate: dueDateRange,
        status: { notIn: TERMINAL_STATUSES },
        assigneeId: { not: null },
      },
      options,
    );
  }

  /**
   * Paginated search combining the standard list filters. Builds the Prisma
   * `where` clause internally so callers only ever deal with
   * `TaskSearchFilters`.
   */
  async search(
    filters: TaskSearchFilters,
    pagination: PaginationQuery,
    options: RepositoryOptions = {},
  ): Promise<{ data: Task[]; meta: PaginationMeta }> {
    const where: Prisma.TaskWhereInput = {};

    if (filters.status) where.status = filters.status;
    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.assigneeId) where.assigneeId = filters.assigneeId;

    if (filters.dueBefore || filters.dueAfter) {
      where.dueDate = {
        ...(filters.dueBefore && { lte: filters.dueBefore }),
        ...(filters.dueAfter && { gte: filters.dueAfter }),
      };
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.paginate(pagination, where, options);
  }

  /**
   * Counts tasks in a given status (e.g. for dashboard widgets).
   */
  async countByStatus(status: TaskStatus, options: RepositoryOptions = {}): Promise<number> {
    return this.count({ status }, options);
  }

  /**
   * Counts tasks belonging to a given project (e.g. for progress rollups).
   */
  async countByProject(projectId: string, options: RepositoryOptions = {}): Promise<number> {
    return this.count({ projectId }, options);
  }
}
