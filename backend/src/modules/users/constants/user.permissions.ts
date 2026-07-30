import { PermissionAction, PermissionResource } from '@shared/enums';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * User Permissions
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Only `READ`/`MANAGE` are defined — the frontend's permission registry
 * (frontend/src/config/permissions.config.ts) only ever declares
 * `PERMISSIONS.USERS_READ`/`PERMISSIONS.USERS_MANAGE` for this resource (no
 * granular CREATE/UPDATE/DELETE), so this mirrors that exactly rather than
 * inventing permissions the frontend never checks. Composed from the shared
 * `PermissionAction`/`PermissionResource` enums (never hand-typed), mirroring
 * `modules/contacts/constants/contact.permissions.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const RESOURCE = PermissionResource.USERS;

export const USER_PERMISSIONS = {
  READ: `${RESOURCE}:${PermissionAction.READ}`,
  MANAGE: `${RESOURCE}:${PermissionAction.MANAGE}`,
} as const;

export type UserPermission = (typeof USER_PERMISSIONS)[keyof typeof USER_PERMISSIONS];
