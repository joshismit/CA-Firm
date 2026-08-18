import { PermissionAction, PermissionResource } from '@shared/enums';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Client Billing Permissions
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Shared by all three sub-resources (Invoices, Expenses, Payments) — the
 * frontend's permission registry defines only `PERMISSIONS.CLIENT_BILLING_READ`/
 * `MANAGE` for this feature (added alongside this module, see
 * `frontend/src/config/permissions.config.ts`), no granular
 * `invoice:read`/`expense:update`/`payments:manage` per entity. Deliberately
 * distinct from `PermissionResource.BILLING` (the unrelated SaaS-subscription
 * resource) — never reuse that one here.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const RESOURCE = PermissionResource.CLIENT_BILLING;

export const CLIENT_BILLING_PERMISSIONS = {
  READ: `${RESOURCE}:${PermissionAction.READ}`,
  MANAGE: `${RESOURCE}:${PermissionAction.MANAGE}`,
} as const;

export type ClientBillingPermission = (typeof CLIENT_BILLING_PERMISSIONS)[keyof typeof CLIENT_BILLING_PERMISSIONS];
