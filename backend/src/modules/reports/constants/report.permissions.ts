import { PermissionAction, PermissionResource } from '@shared/enums';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Report Permissions
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Reuses the existing `PermissionResource.REPORTS` resource and
 * `PermissionAction.READ`/`EXPORT` actions — both already existed in the
 * backend enum and the frontend's `PERMISSIONS.REPORTS_READ`/`REPORTS_EXPORT`
 * registry before this module was implemented. Nothing invented. `READ`
 * gates report generation (`GET /reports/:type`); `EXPORT` gates file export
 * (`GET /reports/:type/export`) — matches the frontend's own gating exactly
 * (`ReportDetailPage.tsx` wraps only the Export CSV/PDF buttons in
 * `<Can permission={PERMISSIONS.REPORTS_EXPORT}>`).
 * ─────────────────────────────────────────────────────────────────────────────
 */
const RESOURCE = PermissionResource.REPORTS;

export const REPORT_PERMISSIONS = {
  READ: `${RESOURCE}:${PermissionAction.READ}`,
  EXPORT: `${RESOURCE}:${PermissionAction.EXPORT}`,
} as const;

export type ReportPermission = (typeof REPORT_PERMISSIONS)[keyof typeof REPORT_PERMISSIONS];
