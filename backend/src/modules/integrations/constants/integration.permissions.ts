import { PermissionAction, PermissionResource } from '@shared/enums';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Integration Permissions (PRD §17)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Same two-tier shape as `CLIENT_BILLING_PERMISSIONS`: `READ` for viewing
 * connections/providers/sync history, `MANAGE` (admin only) for connecting,
 * disconnecting, and triggering syncs — connecting a third-party integration
 * is inherently a firm-admin-level action, never a per-record permission.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const RESOURCE = PermissionResource.INTEGRATIONS;

export const INTEGRATION_PERMISSIONS = {
  READ: `${RESOURCE}:${PermissionAction.READ}`,
  MANAGE: `${RESOURCE}:${PermissionAction.MANAGE}`,
} as const;

export type IntegrationPermission = (typeof INTEGRATION_PERMISSIONS)[keyof typeof INTEGRATION_PERMISSIONS];
