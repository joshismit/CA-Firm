// dashboard module — public exports
//
// Backend-side of the dashboard is deliberately narrow: it owns only the
// caller's personal widget layout (`DashboardPreference`), not an aggregate
// "dashboard data" API — every widget on the frontend's dashboard composes
// data from its own already-real module (Business/Contacts/CRM/Projects/
// Tasks/Documents/Notifications), same as before this module existed. Only
// the router (for mounting) and DTO types are exported — mirrors
// `modules/notifications/index.ts`'s "explicit public surface" precedent.

export { default as dashboardPreferenceRoutes } from './routes/dashboard-preference.routes';
export type { DashboardPreferenceResponseDto } from './dto/dashboard-preference.res.dto';
export type { UpdateDashboardPreferencesDto, WidgetPreferenceDto } from './dto/dashboard-preference.req.dto';
