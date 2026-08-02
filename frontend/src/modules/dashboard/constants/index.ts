// dashboard-scoped constants (enums, option lists, default values).
//
// WIDGET_REGISTRY is the single source of truth for "what widgets exist" - id, label, layout
// size, which permission (if any) a widget requires, and the component that renders it. The
// backend's DashboardPreference (backend/src/modules/dashboard) only ever stores an opaque
// ordered `{ widgetId, visible }[]` against this registry's ids; it has no widget catalog of its
// own (see that module's index.ts header comment). Keeping the catalog here - not on the backend -
// means adding/removing a widget is a frontend-only change, same as how QuickActionsWidget's own
// ACTIONS list already lives entirely on the frontend.

// Imports specific component files directly, NOT the `../components` barrel - that barrel also
// re-exports CustomizeDashboardDrawer, which pulls in ../hooks, which imports WIDGET_REGISTRY from
// this very file. Going through the barrel here would create a real import cycle; importing the
// leaf widget files directly avoids it.
import type { ComponentType } from 'react'
import { PERMISSIONS } from '@/config/permissions.config'
import { KpiStatsWidget } from '../components/KpiStatsWidget'
import { RecentActivityWidget } from '../components/RecentActivityWidget'
import { QuickActionsWidget } from '../components/QuickActionsWidget'
import { CrmPipelineWidget } from '../components/CrmPipelineWidget'
import { TaskSummaryWidget } from '../components/TaskSummaryWidget'
import { UpcomingDeadlinesWidget } from '../components/UpcomingDeadlinesWidget'
import { RecentDocumentsWidget } from '../components/RecentDocumentsWidget'
import { NotificationsPreviewWidget } from '../components/NotificationsPreviewWidget'
import { RevenueWidget, TrendsWidget, TeamPerformanceWidget, CalendarWidget } from '../components/ComingSoonWidgets'

/** Tailwind col-span size within a 12-column grid - keeps the original page's row groupings (see DashboardPage.tsx's git history) without hardcoding which widgets sit next to which. */
export type WidgetSize = 'full' | 'two-thirds' | 'third' | 'half' | 'quarter'

export const WIDGET_SIZE_CLASS: Record<WidgetSize, string> = {
  full: 'col-span-12',
  'two-thirds': 'col-span-12 lg:col-span-8',
  third: 'col-span-12 lg:col-span-4',
  half: 'col-span-12 md:col-span-6',
  quarter: 'col-span-12 sm:col-span-6 lg:col-span-3',
}

export interface Widget {
  id: string
  label: string
  description: string
  size: WidgetSize
  /** Omitted when the widget needs no permission (it self-gates internally, or shows no tenant data). Multiple entries mean "any one of these". */
  permission?: string | string[]
  component: ComponentType
}

export const WIDGET_REGISTRY: Widget[] = [
  {
    id: 'kpi-stats',
    label: 'Key Metrics',
    description: 'Business, contact, lead, and project counts.',
    size: 'full',
    permission: [PERMISSIONS.BUSINESS_READ, PERMISSIONS.CONTACTS_READ, PERMISSIONS.CRM_READ, PERMISSIONS.PROJECTS_READ],
    component: KpiStatsWidget,
  },
  {
    id: 'recent-activity',
    label: 'Recent Activity',
    description: 'Newest businesses, contacts, projects, and documents.',
    size: 'two-thirds',
    permission: [PERMISSIONS.BUSINESS_READ, PERMISSIONS.CONTACTS_READ, PERMISSIONS.PROJECTS_READ, PERMISSIONS.DOCUMENTS_READ],
    component: RecentActivityWidget,
  },
  {
    id: 'quick-actions',
    label: 'Quick Actions',
    description: 'Shortcuts to create a business, contact, lead, project, or document.',
    size: 'third',
    component: QuickActionsWidget,
  },
  {
    id: 'crm-pipeline',
    label: 'CRM Pipeline',
    description: 'Lead pipeline stage breakdown.',
    size: 'full',
    permission: PERMISSIONS.CRM_READ,
    component: CrmPipelineWidget,
  },
  {
    id: 'task-summary',
    label: 'Task Summary',
    description: 'Your upcoming tasks, sorted by due date.',
    size: 'quarter',
    permission: PERMISSIONS.TASKS_READ,
    component: TaskSummaryWidget,
  },
  {
    id: 'upcoming-deadlines',
    label: 'Upcoming Deadlines',
    description: 'Overdue projects and tasks.',
    size: 'quarter',
    permission: [PERMISSIONS.PROJECTS_READ, PERMISSIONS.TASKS_READ],
    component: UpcomingDeadlinesWidget,
  },
  {
    id: 'recent-documents',
    label: 'Recent Documents',
    description: 'Most recently uploaded documents.',
    size: 'quarter',
    permission: PERMISSIONS.DOCUMENTS_READ,
    component: RecentDocumentsWidget,
  },
  {
    id: 'notifications-preview',
    label: 'Notifications',
    description: 'Your most recent notifications.',
    size: 'quarter',
    permission: PERMISSIONS.NOTIFICATIONS_READ,
    component: NotificationsPreviewWidget,
  },
  {
    id: 'revenue',
    label: 'Revenue',
    description: 'Revenue tracking (not available yet).',
    size: 'half',
    component: RevenueWidget,
  },
  {
    id: 'trends',
    label: 'Trends',
    description: 'Trend charts (not available yet).',
    size: 'half',
    component: TrendsWidget,
  },
  {
    id: 'team-performance',
    label: 'Team Performance',
    description: 'Per-staff workload analytics (not available yet).',
    size: 'half',
    component: TeamPerformanceWidget,
  },
  {
    id: 'calendar',
    label: 'Calendar',
    description: 'Shared firm calendar (not available yet).',
    size: 'half',
    component: CalendarWidget,
  },
]

/** The layout every first-time user sees before they've ever saved a preference - registry order, everything visible. */
export const DEFAULT_WIDGET_LAYOUT = WIDGET_REGISTRY.map((widget) => ({ widgetId: widget.id, visible: true }))
