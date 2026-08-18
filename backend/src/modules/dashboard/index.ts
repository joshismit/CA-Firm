// dashboard module — public exports
//
// PRD §10 — the dashboard is an aggregation layer over other modules'
// Services, plus the caller's own widget layout preferences. Three route
// groups are mounted from this module:
//   - `dashboardPreferenceRoutes` (`/dashboard/preferences`) — the caller's
//     own personal widget show/hide + order + size/collapsed/pinned/refresh
//     layout. Self-service, no permission gate (mirrors
//     `modules/notifications`'s own inbox routes).
//   - `dashboardTenantDefaultRoutes` (`/dashboard/tenant-defaults`) — a
//     tenant admin's configured default layout per coarse `UserRole`
//     (PRD §10.3). `requireRole(TENANT_ADMIN)`-gated.
//   - `dashboardRoutes` (`/dashboard`, `/dashboard/widgets`,
//     `/dashboard/calendar`, `/dashboard/activity`, `/dashboard/performance`)
//     — the real aggregation endpoints, composed entirely from other
//     modules' exported Services (`TaskService`, `InvoiceService`,
//     `LeadService`, `ComplianceDashboardReader`, `AuditTimelineReader`,
//     `ReportService`) — see `DashboardAggregationService`'s own header
//     comment. `requireRole(TENANT_ADMIN, MANAGER, STAFF)`-gated.
//
// `DashboardPreferenceRepository`, `DashboardTenantDefaultRepository`,
// `DashboardAggregationService` (used only by this module's own controllers),
// controllers, and mappers are deliberately NOT exported — internal
// implementation details. Mirrors `modules/notifications/index.ts`.

export { default as dashboardPreferenceRoutes } from './routes/dashboard-preference.routes';
export { default as dashboardTenantDefaultRoutes } from './routes/dashboard-tenant-default.routes';
export { default as dashboardRoutes } from './routes/dashboard.routes';
export type { DashboardPreferenceResponseDto } from './dto/dashboard-preference.res.dto';
export type { UpdateDashboardPreferencesDto, WidgetPreferenceDto } from './dto/dashboard-preference.req.dto';
export type { DashboardTenantDefaultResponseDto } from './dto/dashboard-tenant-default.res.dto';
export type { UpdateDashboardTenantDefaultDto } from './dto/dashboard-tenant-default.req.dto';
export type {
  DashboardOverviewResponseDto,
  DashboardWidgetDataResponseDto,
  DashboardCalendarResponseDto,
  DashboardActivityResponseDto,
  DashboardPerformanceResponseDto,
} from './dto/dashboard.res.dto';
export { DASHBOARD_WIDGET_DATA_IDS } from './constants/dashboard-widget-ids';
export type { DashboardWidgetDataId } from './constants/dashboard-widget-ids';
