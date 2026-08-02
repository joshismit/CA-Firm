// dashboard-scoped React hooks - data-fetching wrappers (TanStack Query) and local UI state.
// `retry: false` on the analytics queries below - the underlying API is a guaranteed 501 today
// (see api/index.ts). Other dashboard widgets compose hooks from their own modules directly
// (e.g. tasks, documents) rather than duplicating them here.

import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/query-keys'
import { usePermission } from '@/hooks/use-permission'
import {
  getAnalyticsSummary,
  getClientGrowthTrend,
  getDashboardPreferences,
  getRevenueTrend,
  updateDashboardPreferences,
} from '../api'
import { WIDGET_REGISTRY, type Widget } from '../constants'
import type { AnalyticsFilters, UpdateDashboardPreferencesPayload } from '../types'

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

export function useDashboardPreferencesQuery() {
  return useQuery({ queryKey: queryKeys.dashboard.preferences, queryFn: getDashboardPreferences })
}

export function useUpdateDashboardPreferencesMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateDashboardPreferencesPayload) => updateDashboardPreferences(payload),
    onSuccess: (data) => qc.setQueryData(queryKeys.dashboard.preferences, data),
  })
}

export interface DashboardLayoutEntry {
  widget: Widget
  visible: boolean
}

/**
 * Merges the caller's saved widget layout with `WIDGET_REGISTRY`, filtered down to only the
 * widgets their permissions allow (never renders/offers a widget for a module they can't access -
 * even if an old saved layout still names it, e.g. after a role change).
 *
 * A widget missing from the saved layout - true for every widget on a first-time user's empty
 * layout, and for any new widget shipped after a user already customized their dashboard - is
 * appended at the end as visible, so both "brand new user" and "existing user, new widget" get a
 * sensible default without a separate migration step.
 */
export function useDashboardLayout() {
  const { data, isLoading, isError } = useDashboardPreferencesQuery()
  const { has, hasAny } = usePermission()

  const permittedWidgets = useMemo(
    () =>
      WIDGET_REGISTRY.filter((widget) => {
        if (!widget.permission) return true
        return Array.isArray(widget.permission) ? hasAny(widget.permission) : has(widget.permission)
      }),
    [has, hasAny]
  )

  const entries = useMemo<DashboardLayoutEntry[]>(() => {
    const saved = data?.widgets ?? []
    const savedIds = new Set(saved.map((pref) => pref.widgetId))
    const permittedById = new Map(permittedWidgets.map((widget) => [widget.id, widget]))

    const ordered: DashboardLayoutEntry[] = []
    for (const pref of saved) {
      const widget = permittedById.get(pref.widgetId)
      if (widget) ordered.push({ widget, visible: pref.visible })
    }
    for (const widget of permittedWidgets) {
      if (!savedIds.has(widget.id)) ordered.push({ widget, visible: true })
    }
    return ordered
  }, [data, permittedWidgets])

  return { entries, isLoading, isError }
}
