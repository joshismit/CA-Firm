import { PermissionAction, PermissionResource } from '@shared/enums';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Documents Permissions
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every permission code the Documents module checks via `requirePermission()`.
 * Composed from the shared `PermissionAction`/`PermissionResource` enums
 * (never hand-typed) so a code here can never drift from
 * `shared/enums/permission.enum.ts`. Mirrors
 * `modules/crm/constants/lead.permissions.ts`.
 *
 * `MANAGE`, `EXPORT`, and `APPROVE` are registered ahead of the routes/
 * features that will use them (only CREATE/READ/UPDATE/DELETE are wired to
 * routes today), so the RBAC surface for this module is complete from day
 * one — roles can be granted these permissions before the corresponding
 * endpoints exist.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const RESOURCE = PermissionResource.DOCUMENTS;

export const DOCUMENT_PERMISSIONS = {
  CREATE: `${RESOURCE}:${PermissionAction.CREATE}`,
  READ: `${RESOURCE}:${PermissionAction.READ}`,
  UPDATE: `${RESOURCE}:${PermissionAction.UPDATE}`,
  DELETE: `${RESOURCE}:${PermissionAction.DELETE}`,
  MANAGE: `${RESOURCE}:${PermissionAction.MANAGE}`,
  EXPORT: `${RESOURCE}:${PermissionAction.EXPORT}`,
  APPROVE: `${RESOURCE}:${PermissionAction.APPROVE}`,
} as const;

export type DocumentPermission = (typeof DOCUMENT_PERMISSIONS)[keyof typeof DOCUMENT_PERMISSIONS];
