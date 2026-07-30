// dashboard-scoped React hooks - data-fetching wrappers (TanStack Query) and local UI state.
// `retry: false` on the analytics queries below - the underlying API is a guaranteed 501 today
// (see api/index.ts). Other dashboard widgets compose hooks from their own modules directly
// (e.g. tasks, documents) rather than duplicating them here.

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/services/query-keys'
import { getAnalyticsSummary, getClientGrowthTrend, getRevenueTrend } from '../api'
import type { AnalyticsFilters } from '../types'

export function useAnalyticsSummaryQuery(filters: AnalyticsFilters) {
  return useQuery({
    queryKey: queryKeys.dashboard.analyticsSummary(filters),
    queryFn: () => getAnalyticsSummary(filters),
    retry: false,
  })
}

export function useRevenueTrendQuery(filters: AnalyticsFilters) {
  return useQuery({
    queryKey: queryKeys.dashboard.revenueTrend(filters),
    queryFn: () => getRevenueTrend(filters),
    retry: false,
  })
}

export function useClientGrowthTrendQuery(filters: AnalyticsFilters) {
  return useQuery({
    queryKey: queryKeys.dashboard.clientGrowthTrend(filters),
    queryFn: () => getClientGrowthTrend(filters),
    retry: false,
  })
}
