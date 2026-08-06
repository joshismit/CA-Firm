import { PermissionAction, PermissionResource } from '@shared/enums';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Task Permissions
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every permission code the Tasks module checks via `requirePermission()`.
 * Composed from the shared `PermissionAction`/`PermissionResource` enums
 * (never hand-typed) so a code here can never drift from
 * `shared/enums/permission.enum.ts`. Mirrors
 * `modules/projects/constants/project.permissions.ts`.
 *
 * `EXPORT` is registered ahead of the route that will use it (task export) so
 * the RBAC surface for this module is complete from day one — roles can be
 * granted it before the corresponding endpoint exists.
 *
 * `APPROVE`/`ASSIGN`/`REVIEW`/`COMPLETE` gate the PRD §9 approval-workflow
 * actions (`POST /tasks/:id/approve|assign|reject|complete`) — see
 * `routes/task.routes.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const RESOURCE = PermissionResource.TASKS;

export const TASK_PERMISSIONS = {
  CREATE: `${RESOURCE}:${PermissionAction.CREATE}`,
  READ: `${RESOURCE}:${PermissionAction.READ}`,
  UPDATE: `${RESOURCE}:${PermissionAction.UPDATE}`,
  DELETE: `${RESOURCE}:${PermissionAction.DELETE}`,
  MANAGE: `${RESOURCE}:${PermissionAction.MANAGE}`,
  EXPORT: `${RESOURCE}:${PermissionAction.EXPORT}`,
  APPROVE: `${RESOURCE}:${PermissionAction.APPROVE}`,
  ASSIGN: `${RESOURCE}:${PermissionAction.ASSIGN}`,
  REVIEW: `${RESOURCE}:${PermissionAction.REVIEW}`,
  COMPLETE: `${RESOURCE}:${PermissionAction.COMPLETE}`,
} as const;

export type TaskPermission = (typeof TASK_PERMISSIONS)[keyof typeof TASK_PERMISSIONS];
