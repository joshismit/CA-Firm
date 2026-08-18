import { PermissionAction, PermissionResource } from '@shared/enums';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Business Permissions
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every permission code the Business module checks via `requirePermission()`.
 * Composed from the shared `PermissionAction`/`PermissionResource` enums
 * (never hand-typed) so a code here can never drift from
 * `shared/enums/permission.enum.ts`. Mirrors
 * `modules/projects/constants/project.permissions.ts`.
 *
 * `DELETE`, `MANAGE`, `EXPORT`, and `APPROVE` are registered ahead of the
 * routes/features that will use them (only CREATE/READ/UPDATE/DELETE are
 * wired to routes today), so the RBAC surface for this module is complete
 * from day one — roles can be granted these permissions before the
 * corresponding endpoints exist.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const RESOURCE = PermissionResource.BUSINESS;

export const BUSINESS_PERMISSIONS = {
  CREATE: `${RESOURCE}:${PermissionAction.CREATE}`,
  READ: `${RESOURCE}:${PermissionAction.READ}`,
  UPDATE: `${RESOURCE}:${PermissionAction.UPDATE}`,
  DELETE: `${RESOURCE}:${PermissionAction.DELETE}`,
  MANAGE: `${RESOURCE}:${PermissionAction.MANAGE}`,
  EXPORT: `${RESOURCE}:${PermissionAction.EXPORT}`,
  APPROVE: `${RESOURCE}:${PermissionAction.APPROVE}`,
} as const;

export type BusinessPermission = (typeof BUSINESS_PERMISSIONS)[keyof typeof BUSINESS_PERMISSIONS];
