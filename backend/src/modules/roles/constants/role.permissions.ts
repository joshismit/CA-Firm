import { PermissionAction, PermissionResource } from '@shared/enums';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Role Permissions
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Only `READ`/`MANAGE` — the frontend's permission registry
 * (frontend/src/config/permissions.config.ts) only ever declares
 * `PERMISSIONS.ROLES_READ`/`PERMISSIONS.ROLES_MANAGE` for this resource (no
 * granular CREATE/UPDATE/DELETE), so this mirrors that exactly rather than
 * inventing permissions the frontend never checks. Mirrors
 * `modules/users/constants/user.permissions.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const RESOURCE = PermissionResource.ROLES;

export const ROLE_PERMISSIONS = {
  READ: `${RESOURCE}:${PermissionAction.READ}`,
  MANAGE: `${RESOURCE}:${PermissionAction.MANAGE}`,
} as const;

export type RolePermission = (typeof ROLE_PERMISSIONS)[keyof typeof ROLE_PERMISSIONS];
