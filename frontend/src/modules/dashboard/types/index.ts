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
