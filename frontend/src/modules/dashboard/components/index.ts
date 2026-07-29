// dashboard feature-specific components - not reused outside this module. Promote to src/components if reuse emerges.
// KPICard/StatisticsCard/RevenueChart/GSTStatusCard/RecentTasksWidget were removed - they were all
// built around fabricated data (fake trend %, fake revenue, fake GST filing counts, a "priority"
// field Task doesn't have) with no real equivalent anywhere in the app. The shared StatCard already
// covers "real number, honest dash on error" everywhere else in this app; ChartCard is kept since
// it's a generic Card+header wrapper, not mock-specific.

export * from './ChartCard'
export * from './RecentActivityWidget'
export * from './TaskSummaryWidget'
export * from './UpcomingDeadlinesWidget'
export * from './RecentDocumentsWidget'
export * from './NotificationsPreviewWidget'
export * from './QuickActionsWidget'
