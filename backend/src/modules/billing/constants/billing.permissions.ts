import { PermissionAction, PermissionResource } from '@shared/enums';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Billing Permissions
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Only READ/MANAGE — mirrors `modules/client-billing/constants/client-billing.permissions.ts`'s
 * shape exactly. `PermissionResource.BILLING` (the tenant's own SaaS
 * subscription) is deliberately distinct from `PermissionResource.CLIENT_BILLING`
 * (the firm's billing of its own clients) — never conflated.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const RESOURCE = PermissionResource.BILLING;

export const BILLING_PERMISSIONS = {
  READ: `${RESOURCE}:${PermissionAction.READ}`,
  MANAGE: `${RESOURCE}:${PermissionAction.MANAGE}`,
} as const;

export type BillingPermission = (typeof BILLING_PERMISSIONS)[keyof typeof BILLING_PERMISSIONS];
