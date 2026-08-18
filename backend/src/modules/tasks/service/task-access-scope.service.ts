import { Prisma } from '@prisma/client';
import { prisma } from '@config/database';
import { UserRole } from '@shared/enums';
import { RequestUser } from '@shared/types';
import { ForbiddenError } from '@shared/errors';
import { ContactRepository } from '@modules/contacts/repository/contact.repository';
import { ContactRoleRepository } from '@modules/contacts/repository/contact-role.repository';
import { TASK_PERMISSIONS } from '../constants/task.permissions';

/** The subset of `Task` fields every scope check needs — never the full row. */
export interface ScopedTask {
  id: string;
  assigneeId: string | null;
  createdBy: string | null;
  businessId: string | null;
}

/**
 * The result of resolving a user's task access scope.
 *
 * - `{}` (both undefined)   → unrestricted, tenant-wide (holds `tasks:read`/`tasks:manage`/
 *   `tasks:review`/`tasks:approve`, or is TENANT_ADMIN/MASTER_ADMIN). Since every existing task
 *   read route already requires `tasks:read`, this is the common case for staff — visibility is
 *   deliberately tenant-wide for anyone who can read tasks at all; modification stays gated
 *   separately by `tasks:update`/`tasks:assign`/`tasks:approve`/etc (see `TaskService`).
 * - `businessIds` set        → CLIENT only: restricted to tasks on these Business(es), resolved
 *   from the caller's own `Contact.portalUserId -> ContactRole -> businessId`. `[]` means the
 *   caller has no linked Contact (or no Business roles) — zero access, not an error.
 * - `userId` set             → restricted to tasks where this user is the assignee or creator.
 *   Kept only as a defensive fallback for a caller who somehow lacks `tasks:read` — every real
 *   STAFF/CLIENT caller today is routed to one of the two branches above instead.
 */
export interface TaskAccessScope {
  userId?: string;
  businessIds?: string[];
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
 * Tasks restricts by assignee/creator identity (staff, as a defensive
 * fallback) or Business (CLIENT), gated on permissions/role rather than a
 * coarse-role allow-list.
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
 *
 * Resolved fresh from the DB on every call for the CLIENT branch (not cached
 * in the JWT): a newly created/removed `ContactRole` must take effect without
 * the affected user needing to log out and back in — mirrors
 * `DocumentAccessScopeService`'s same reasoning.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class TaskAccessScopeService {
  constructor(
    private readonly contactRepository: ContactRepository = new ContactRepository(prisma),
    private readonly contactRoleRepository: ContactRoleRepository = new ContactRoleRepository(prisma),
  ) {}

  async resolve(user: RequestUser): Promise<TaskAccessScope> {
    // Checked BEFORE the permission-based unrestricted rule below: CLIENT_PERMISSION_CODES
    // grants CLIENT users `tasks:read` too (they need it to see their own tasks at all), so if
    // the unrestricted check ran first, holding `tasks:read` would make every CLIENT tenant-wide
    // unrestricted — exactly the cross-client leak this branch exists to prevent.
    if (user.role === UserRole.CLIENT) {
      return this.resolveClientScope(user);
    }

    const unrestricted =
      user.role === UserRole.MASTER_ADMIN ||
      user.role === UserRole.TENANT_ADMIN ||
      user.permissions.includes(TASK_PERMISSIONS.MANAGE) ||
      user.permissions.includes(TASK_PERMISSIONS.REVIEW) ||
      user.permissions.includes(TASK_PERMISSIONS.APPROVE) ||
      user.permissions.includes(TASK_PERMISSIONS.READ);

    return unrestricted ? {} : { userId: user.id };
  }

  private async resolveClientScope(user: RequestUser): Promise<TaskAccessScope> {
    if (!user.tenantId) return { businessIds: [] };

    const contact = await this.contactRepository.findFirst({ portalUserId: user.id }, { tenantId: user.tenantId });
    if (!contact) return { businessIds: [] };

    const roles = await this.contactRoleRepository.findByContact(contact.id, { tenantId: user.tenantId });
    return { businessIds: [...new Set(roles.map((role) => role.businessId))] };
  }

  /** Throws `ForbiddenError` if `task` falls outside `scope`. */
  static assertAllowed(task: ScopedTask, scope: TaskAccessScope): void {
    if (scope.businessIds) {
      if (!task.businessId || !scope.businessIds.includes(task.businessId)) {
        throw new ForbiddenError('You do not have access to this task.');
      }
      return;
    }

    if (!scope.userId) return;

    if (task.assigneeId !== scope.userId && task.createdBy !== scope.userId) {
      throw new ForbiddenError('You do not have access to this task.');
    }
  }

  /** Builds the extra `where` fragment `TaskRepository` ANDs onto its own filters. */
  static toWhereInput(scope: TaskAccessScope): Prisma.TaskWhereInput {
    if (scope.businessIds) {
      return { businessId: { in: scope.businessIds } };
    }

    if (!scope.userId) return {};

    return { OR: [{ assigneeId: scope.userId }, { createdBy: scope.userId }] };
  }
}
