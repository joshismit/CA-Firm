import { Prisma } from '@prisma/client';
import { UserRole } from '@shared/enums';
import { RequestUser } from '@shared/types';
import { ForbiddenError } from '@shared/errors';
import { TASK_PERMISSIONS } from '../constants/task.permissions';

/** The subset of `Task` fields every scope check needs — never the full row. */
export interface ScopedTask {
  id: string;
  assigneeId: string | null;
  createdBy: string | null;
}

/**
 * The result of resolving a user's task access scope.
 *
 * - `userId` undefined → unrestricted, tenant-wide (holds `tasks:manage`, or is
 *   TENANT_ADMIN/MASTER_ADMIN — the same "admins always see everything" floor
 *   `DocumentAccessScopeService` gives its own unrestricted roles).
 * - `userId` set       → restricted to tasks where this user is the assignee or creator.
 */
export interface TaskAccessScope {
  userId?: string;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Task Access Scope Service (PRD §14.6)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Centralizes the "which tasks may this specific user touch" question —
 * `requirePermission()` alone can't answer it, since a flat `tasks:read` grant
 * has no notion of *whose* task a given row is. Mirrors
 * `documents/service/document-access-scope.service.ts`'s shape
 * (`assertAllowed`/`toWhereInput`, resolved once per request) — same pattern,
 * a different gate: Documents restricts by Business/category assignment,
 * Tasks restricts by assignee/creator identity, gated on permissions rather
 * than a coarse-role allow-list.
 *
 * Applied to READS only (`getTaskById`/`listTasks`/`getOverdueTasks`/
 * `getPendingReviewTasks`) — deliberately NOT to any mutation. `Task` has no
 * `reviewerId`/`approverId` field (see the PRD audit): a Reviewer/Approver's
 * authority to act on a task neither they created nor are assigned to comes
 * entirely from holding `tasks:review`/`tasks:approve`, by this module's
 * existing design — the same reason those permission codes exist. Gating
 * `updateTaskStatus()` by ownership on top would have broken exactly that
 * (a reviewer approving someone else's submitted task is the *normal* case,
 * not an edge case), so `tasks:review`/`tasks:approve` holders are treated
 * as unrestricted here too — they need the same tenant-wide visibility
 * `tasks:manage` grants, just scoped to reviewing rather than everything.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class TaskAccessScopeService {
  resolve(user: RequestUser): TaskAccessScope {
    const unrestricted =
      user.role === UserRole.MASTER_ADMIN ||
      user.role === UserRole.TENANT_ADMIN ||
      user.permissions.includes(TASK_PERMISSIONS.MANAGE) ||
      user.permissions.includes(TASK_PERMISSIONS.REVIEW) ||
      user.permissions.includes(TASK_PERMISSIONS.APPROVE);

    return unrestricted ? {} : { userId: user.id };
  }

  /** Throws `ForbiddenError` if `task` falls outside `scope`. */
  static assertAllowed(task: ScopedTask, scope: TaskAccessScope): void {
    if (!scope.userId) return;

    if (task.assigneeId !== scope.userId && task.createdBy !== scope.userId) {
      throw new ForbiddenError('You do not have access to this task.');
    }
  }

  /** Builds the extra `where` fragment `TaskRepository` ANDs onto its own filters. */
  static toWhereInput(scope: TaskAccessScope): Prisma.TaskWhereInput {
    if (!scope.userId) return {};

    return { OR: [{ assigneeId: scope.userId }, { createdBy: scope.userId }] };
  }
}
