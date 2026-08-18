import { PermissionAction, PermissionResource } from '@shared/enums';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Project Permissions
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every permission code the Projects module checks via `requirePermission()`.
 * Composed from the shared `PermissionAction`/`PermissionResource` enums
 * (never hand-typed) so a code here can never drift from
 * `shared/enums/permission.enum.ts`.
 *
 * `EXPORT` and `APPROVE` are registered ahead of the routes that will use them
 * (project export, engagement completion approval) so the RBAC surface for
 * this module is complete from day one — roles can be granted these
 * permissions before the corresponding endpoints exist.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const RESOURCE = PermissionResource.PROJECTS;

export const PROJECT_PERMISSIONS = {
  CREATE: `${RESOURCE}:${PermissionAction.CREATE}`,
  READ: `${RESOURCE}:${PermissionAction.READ}`,
  UPDATE: `${RESOURCE}:${PermissionAction.UPDATE}`,
  DELETE: `${RESOURCE}:${PermissionAction.DELETE}`,
  MANAGE: `${RESOURCE}:${PermissionAction.MANAGE}`,
  EXPORT: `${RESOURCE}:${PermissionAction.EXPORT}`,
  APPROVE: `${RESOURCE}:${PermissionAction.APPROVE}`,
} as const;

export type ProjectPermission = (typeof PROJECT_PERMISSIONS)[keyof typeof PROJECT_PERMISSIONS];
