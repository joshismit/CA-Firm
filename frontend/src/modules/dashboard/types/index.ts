// TypeScript types and interfaces scoped to dashboard.
// PROVISIONAL: analytics are computed/aggregated views, not backed by a reporting/analytics
// backend module yet (see api/index.ts's header comment) - these describe the eventual API
// contract only, distinct from the other dashboard widgets in this module which already have real
// data sources.

export interface AnalyticsFilters {
  from?: string
  to?: string
}

export interface AnalyticsSummary {
  totalRevenue: number
  activeClients: number
  pendingFilings: number
}

export interface RevenueDatum {
  month: string
  revenue: number
  collections: number
}

export interface ClientGrowthDatum {
  month: string
  newClients: number
}

// Backed by a real endpoint - GET/PATCH /dashboard/preferences (backend/src/modules/dashboard),
// unlike AnalyticsSummary/RevenueDatum/ClientGrowthDatum above. `widgetId` matches a `Widget.id`
// from `../constants` - the backend treats it as an opaque string and never validates membership.

/** Tailwind col-span size override - mirrors `WidgetSize` in `../constants`, duplicated here to
 * avoid a types->constants import (constants already imports from here). */
export type WidgetSizeOverride = 'full' | 'two-thirds' | 'third' | 'half' | 'quarter'

/** One entry in a saved dashboard layout. Array position (not a separate field) is display order. */
export interface WidgetPreference {
  widgetId: string
  visible: boolean
  /** PRD §10.2/§10.4 - per-widget layout overrides. Absent means "use the registry default." */
  size?: WidgetSizeOverride
  collapsed?: boolean
  pinned?: boolean
}

export interface DashboardPreferences {
  widgets: WidgetPreference[]
  updatedAt: string | null
  source: 'personal' | 'tenant-default' | 'registry'
  refreshIntervalSeconds: number | null
}

export interface UpdateDashboardPreferencesPayload {
  widgets: WidgetPreference[]
  refreshIntervalSeconds?: number | null
}

// PRD §10.10 - real aggregation endpoints (backend/src/modules/dashboard/routes/dashboard.routes.ts).
// Backend-computed only - this module never re-derives these numbers client-side (PRD §10.7).

export interface DashboardOverview {
  pendingWorksCount: number
  dueDatesCount: number
  paymentRemindersCount: number
  complianceDeadlinesCount: number
  assignedClientsCount: number
  outstandingPaymentsCount: number
  outstandingPaymentsTotal: number
  generatedAt: string
}

/** The 6 widget ids `GET /dashboard/widgets` can return data for - must stay in manual sync with
 * the backend's `DASHBOARD_WIDGET_DATA_IDS` (`backend/src/modules/dashboard/constants/dashboard-widget-ids.ts`). */
export type DashboardWidgetDataId =
  | 'pending-works'
  | 'due-dates'
  | 'payment-reminders'
  | 'compliance-deadlines'
  | 'assigned-clients'
  | 'outstanding-payments'

export interface TaskSummaryItem {
  id: string
  title: string
  status: string
  priority: string | null
  dueDate: string | null
  isOverdue: boolean
}

export interface InvoiceSummaryItem {
  id: string
  invoiceNumber: string
  businessName: string | null
  amount: number
  dueDate: string | null
  status: string
}

export interface ComplianceFilingSummaryItem {
  id: string
  category: string
  reference: string
  period: string
  status: string
  dueDate: string | null
}

export interface ClientSummaryItem {
  id: string
  businessId: string
  businessName: string | null
  status: string
}

export type DashboardWidgetItem = TaskSummaryItem | InvoiceSummaryItem | ComplianceFilingSummaryItem | ClientSummaryItem

export interface DashboardWidgetDataEntry {
  items: DashboardWidgetItem[]
  total: number
  totalAmount?: number
}

export type DashboardWidgetDataResponse = Partial<Record<DashboardWidgetDataId, DashboardWidgetDataEntry>>

export interface CalendarEntry {
  id: string
  type: 'task' | 'compliance' | 'invoice'
  title: string
  date: string
  href: string
}

export interface DashboardCalendar {
  items: CalendarEntry[]
}

export interface ActivityEntry {
  id: string
  eventType: string
  description: string
  actorName: string
  targetType: string | null
  targetId: string | null
  createdAt: string
}

export interface DashboardActivity {
  items: ActivityEntry[]
}

export interface DashboardPerformance {
  range: { from: string; to: string }
  tasks: { completed: number; pending: number; overdue: number }
  documentsUploaded: number
  pendingPayments: number
  /** Only present for unrestricted roles (TENANT_ADMIN/MANAGER/MASTER_ADMIN) - PRD §10.11. */
  staffBreakdown: Record<string, unknown>[] | null
}

// PRD §10.3 - tenant-admin-configurable default layout per coarse role.

export interface DashboardTenantDefault {
  role: 'MASTER_ADMIN' | 'TENANT_ADMIN' | 'MANAGER' | 'STAFF' | 'CLIENT'
  widgets: WidgetPreference[]
  updatedAt: string | null
}
