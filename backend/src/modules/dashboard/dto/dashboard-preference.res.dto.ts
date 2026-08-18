import { WidgetPreferenceDto } from './dashboard-preference.req.dto';

/**
 * Response DTO. `widgets` is `[]` (never null) for a first-time user who
 * hasn't saved a layout yet — the frontend's widget registry supplies the
 * default order/visibility in that case, mirroring how
 * `TenantBrandingResponseDto` returns an empty/all-null shape rather than
 * 404ing for a tenant that never configured branding.
 */
export interface DashboardPreferenceResponseDto {
  widgets: WidgetPreferenceDto[];
  updatedAt: string | null;
  /** PRD §10.3 — where this layout came from: the caller's own saved row, the tenant/role
   * default a tenant admin configured, or neither (frontend registry default applies client-side). */
  source: 'personal' | 'tenant-default' | 'registry';
  refreshIntervalSeconds: number | null;
}
