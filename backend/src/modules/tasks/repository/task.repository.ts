import { PrismaClient, Prisma, Task, TaskStatus, TaskType, TaskPriority } from '@prisma/client';
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
  /** PRD §10.5 — dashboard "Pending Works"/"Due Dates" widgets filter by several open statuses at once. Takes precedence over `status` when both are given. */
  statusIn?: TaskStatus[];
  projectId?: string;
  leadId?: string;
  assigneeId?: string;
  businessId?: string;
  clientId?: string;
  contactId?: string;
  /** PRD §9 */
  type?: TaskType;
  priority?: TaskPriority;
  dueBefore?: Date;
  dueAfter?: Date;
  /** Matches against `title` or `description` (case-insensitive). */
  search?: string;
}

/** Statuses that no longer count as "open"/overdue-eligible work. Exported for `TaskService.searchForDashboard()` (PRD §10.5) so the dashboard's "open task" definition never drifts from this repository's own. */
export const TERMINAL_STATUSES: TaskStatus[] = [TaskStatus.COMPLETED, TaskStatus.CANCELLED];

/** PRD §9 — awaiting a reviewer's decision (approval workflow only). */
const PENDING_REVIEW_STATUSES: TaskStatus[] = [TaskStatus.SUBMITTED, TaskStatus.UNDER_REVIEW];

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
   * Finds all follow-up tasks linked to a given CRM Lead, newest first.
   * PRD §8.7 — the "reuse Tasks instead of another reminder system" mechanism.
   */
  async findByLead(leadId: string, options: RepositoryOptions = {}): Promise<Task[]> {
    return this.findMany({ leadId }, options, undefined, { createdAt: 'desc' });
  }

  /**
   * Finds all tasks assigned to a given user, newest first.
   */
  async findByAssignee(assigneeId: string, options: RepositoryOptions = {}): Promise<Task[]> {
    return this.findMany({ assigneeId }, options, undefined, { createdAt: 'desc' });
  }

  /**
   * Finds open (non-terminal) tasks whose due date has passed. `scopeWhere` is ANDed onto the
   * built filter — the caller's `TaskAccessScopeService.toWhereInput()` result, same pattern as
   * `DocumentRepository.search()`'s identically-named parameter.
   */
  async findOverdue(options: RepositoryOptions = {}, scopeWhere?: Prisma.TaskWhereInput): Promise<Task[]> {
    const where: Prisma.TaskWhereInput = {
      dueDate: { lt: new Date() },
      status: { notIn: TERMINAL_STATUSES },
    };
    const combinedWhere = scopeWhere && Object.keys(scopeWhere).length > 0 ? { AND: [where, scopeWhere] } : where;

    return this.findMany(combinedWhere, options, undefined, { dueDate: 'asc' });
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
   * Tasks awaiting a reviewer's decision (SUBMITTED or UNDER_REVIEW) — PRD §9.
   * Mirrors `findOverdue()`'s shape, ordered oldest-due first.
   */
  async findPendingReview(options: RepositoryOptions = {}, scopeWhere?: Prisma.TaskWhereInput): Promise<Task[]> {
    const where: Prisma.TaskWhereInput = { status: { in: PENDING_REVIEW_STATUSES } };
    const combinedWhere = scopeWhere && Object.keys(scopeWhere).length > 0 ? { AND: [where, scopeWhere] } : where;

    return this.findMany(combinedWhere, options, undefined, { dueDate: 'asc' });
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
    scopeWhere?: Prisma.TaskWhereInput,
  ): Promise<{ data: Task[]; meta: PaginationMeta }> {
    const where: Prisma.TaskWhereInput = {};

    if (filters.statusIn) where.status = { in: filters.statusIn };
    else if (filters.status) where.status = filters.status;
    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.leadId) where.leadId = filters.leadId;
    if (filters.assigneeId) where.assigneeId = filters.assigneeId;
    if (filters.businessId) where.businessId = filters.businessId;
    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.contactId) where.contactId = filters.contactId;
    if (filters.type) where.type = filters.type;
    if (filters.priority) where.priority = filters.priority;

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

    const combinedWhere = scopeWhere && Object.keys(scopeWhere).length > 0 ? { AND: [where, scopeWhere] } : where;

    return this.paginate(pagination, combinedWhere, options);
  }

  /**
   * PRD §13.1 Global Search — "Task title" (`contains`, backed by the
   * `title` trigram GIN index). Deliberately separate from `search()` — see
   * `BusinessRepository.findForGlobalSearch()`'s identical reasoning.
   */
  async findForGlobalSearch(search: string, limit: number, options: RepositoryOptions = {}): Promise<Task[]> {
    const where: Prisma.TaskWhereInput = { title: { contains: search, mode: 'insensitive' } };
    const { data } = await this.paginate({ page: 1, limit, sortBy: 'createdAt', sortOrder: 'desc' }, where, options);
    return data;
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

  /**
   * Counts open (non-terminal) CRM follow-up tasks (`leadId` set) due within
   * `dueDateRange` — the "Upcoming Follow-ups" CRM dashboard stat (PRD §8.10).
   * Reuses the same terminal-status exclusion as `findOverdue`/`findReminderCandidates`.
   */
  async countUpcomingLeadFollowUps(dueDateRange: { gte: Date; lte: Date }, options: RepositoryOptions = {}): Promise<number> {
    return this.count(
      {
        leadId: { not: null },
        dueDate: dueDateRange,
        status: { notIn: TERMINAL_STATUSES },
      },
      options,
    );
  }
}
