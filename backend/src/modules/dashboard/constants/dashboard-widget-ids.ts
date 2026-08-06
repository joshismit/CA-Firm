/**
 * Fixed catalog of "list-shaped" dashboard widgets `GET /dashboard/widgets` can return data for
 * (PRD §10.1/§10.5/§10.10). Deliberately NOT the same "opaque, backend-never-validates" widgetId
 * this module's `DashboardPreference.widgets` uses (see `dashboard-preference.schema.ts`'s header
 * comment) — this list has to be a closed set because `DashboardAggregationService.getWidgetData()`
 * must know exactly which repository/service to call per id. Must be kept in manual sync with the
 * matching 6 entries in the frontend's `WIDGET_REGISTRY`
 * (`frontend/src/modules/dashboard/constants/index.ts`) — this repo has no shared codegen between
 * the two apps.
 */
export const DASHBOARD_WIDGET_DATA_IDS = [
  'pending-works',
  'due-dates',
  'payment-reminders',
  'compliance-deadlines',
  'assigned-clients',
  'outstanding-payments',
] as const;

export type DashboardWidgetDataId = (typeof DASHBOARD_WIDGET_DATA_IDS)[number];
