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
 * `EXPORT` and `APPROVE` are registered ahead of the routes that will use them
 * (task export, review/approval sign-off) so the RBAC surface for this
 * module is complete from day one — roles can be granted these permissions
 * before the corresponding endpoints exist.
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
} as const;

export type TaskPermission = (typeof TASK_PERMISSIONS)[keyof typeof TASK_PERMISSIONS];
