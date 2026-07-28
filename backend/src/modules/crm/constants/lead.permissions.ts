import { PermissionAction, PermissionResource } from '@shared/enums';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CRM (Lead) Permissions
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every permission code the CRM module checks via `requirePermission()`.
 * Composed from the shared `PermissionAction`/`PermissionResource` enums
 * (never hand-typed) so a code here can never drift from
 * `shared/enums/permission.enum.ts`. Mirrors
 * `modules/business/constants/business.permissions.ts`.
 *
 * `EXPORT` and `APPROVE` are registered ahead of the routes/features that
 * will use them (only CREATE/READ/UPDATE/DELETE/MANAGE are wired to routes
 * today), so the RBAC surface for this module is complete from day one.
 * Lead conversion is gated on `MANAGE` — it creates a Client and a primary
 * ContactRole, a more significant action than a routine field edit.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const RESOURCE = PermissionResource.CRM;

export const CRM_PERMISSIONS = {
  CREATE: `${RESOURCE}:${PermissionAction.CREATE}`,
  READ: `${RESOURCE}:${PermissionAction.READ}`,
  UPDATE: `${RESOURCE}:${PermissionAction.UPDATE}`,
  DELETE: `${RESOURCE}:${PermissionAction.DELETE}`,
  MANAGE: `${RESOURCE}:${PermissionAction.MANAGE}`,
  EXPORT: `${RESOURCE}:${PermissionAction.EXPORT}`,
  APPROVE: `${RESOURCE}:${PermissionAction.APPROVE}`,
} as const;

export type CrmPermission = (typeof CRM_PERMISSIONS)[keyof typeof CRM_PERMISSIONS];
