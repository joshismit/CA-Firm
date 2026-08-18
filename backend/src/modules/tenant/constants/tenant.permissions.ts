import { PermissionAction, PermissionResource } from '@shared/enums';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Tenant (Branding / Custom Domain) Permissions
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Reuses `PermissionResource.SETTINGS` — the frontend's registry
 * (`frontend/src/config/permissions.config.ts`) has no dedicated
 * `BRANDING`/`DOMAIN` resource, and branding/custom-domain configuration is,
 * from a permissions standpoint, exactly the kind of firm-wide settings
 * `PERMISSIONS.SETTINGS_READ`/`SETTINGS_MANAGE` already exists to gate.
 * Nothing invented. Mirrors `modules/billing/constants/billing.permissions.ts`'s
 * reasoning for reusing an existing resource rather than adding a new one.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const RESOURCE = PermissionResource.SETTINGS;

export const TENANT_SETTINGS_PERMISSIONS = {
  READ: `${RESOURCE}:${PermissionAction.READ}`,
  MANAGE: `${RESOURCE}:${PermissionAction.MANAGE}`,
} as const;

export type TenantSettingsPermission = (typeof TENANT_SETTINGS_PERMISSIONS)[keyof typeof TENANT_SETTINGS_PERMISSIONS];
