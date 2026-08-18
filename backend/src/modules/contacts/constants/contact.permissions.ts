import { PermissionAction, PermissionResource } from '@shared/enums';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Contact Permissions
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every permission code the Contacts module checks via `requirePermission()`.
 * Composed from the shared `PermissionAction`/`PermissionResource` enums
 * (never hand-typed) so a code here can never drift from
 * `shared/enums/permission.enum.ts`. Mirrors
 * `modules/business/constants/business.permissions.ts`.
 *
 * `DELETE`, `MANAGE`, `EXPORT`, and `APPROVE` are registered ahead of the
 * routes/features that will use them (only CREATE/READ/UPDATE/DELETE are
 * wired to routes today), so the RBAC surface for this module is complete
 * from day one — roles can be granted these permissions before the
 * corresponding endpoints exist.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const RESOURCE = PermissionResource.CONTACTS;

export const CONTACT_PERMISSIONS = {
  CREATE: `${RESOURCE}:${PermissionAction.CREATE}`,
  READ: `${RESOURCE}:${PermissionAction.READ}`,
  UPDATE: `${RESOURCE}:${PermissionAction.UPDATE}`,
  DELETE: `${RESOURCE}:${PermissionAction.DELETE}`,
  MANAGE: `${RESOURCE}:${PermissionAction.MANAGE}`,
  EXPORT: `${RESOURCE}:${PermissionAction.EXPORT}`,
  APPROVE: `${RESOURCE}:${PermissionAction.APPROVE}`,
} as const;

export type ContactPermission = (typeof CONTACT_PERMISSIONS)[keyof typeof CONTACT_PERMISSIONS];
