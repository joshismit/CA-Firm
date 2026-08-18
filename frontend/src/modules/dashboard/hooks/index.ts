// dashboard-scoped React hooks - data-fetching wrappers (TanStack Query) and local UI state.
// `retry: false` on the analytics queries below - the underlying API is a guaranteed 501 today
// (see api/index.ts). Other dashboard widgets compose hooks from their own modules directly
// (e.g. tasks, documents) rather than duplicating them here.

import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/query-keys'
import { usePermission } from '@/hooks/use-permission'
import {
  deleteDashboardTenantDefault,
  getAnalyticsSummary,
  getClientGrowthTrend,
  getDashboardActivity,
  getDashboardCalendar,
  getDashboardOverview,
  getDashboardPerformance,
  getDashboardPreferences,
  getDashboardTenantDefaults,
  getDashboardWidgetData,
  getRevenueTrend,
  resetDashboardPreferences,
  updateDashboardPreferences,
  updateDashboardTenantDefault,
} from '../api'
import { WIDGET_REGISTRY, type Widget } from '../constants'
import type { AnalyticsFilters, DashboardWidgetDataId, UpdateDashboardPreferencesPayload, WidgetPreference } from '../types'

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

/** PRD §10.4 "Restore Defaults". */
export function useResetDashboardPreferencesMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => resetDashboardPreferences(),
    onSuccess: (data) => qc.setQueryData(queryKeys.dashboard.preferences, data),
  })
}

/** PRD §10.10 - the compact counts-only overview bundle (`GET /dashboard`). */
export function useDashboardOverviewQuery() {
  return useQuery({ queryKey: queryKeys.dashboard.overview, queryFn: getDashboardOverview })
}

/** PRD §10.10 - list-shaped data for one or more widgets in a single round trip. */
export function useDashboardWidgetDataQuery(ids: DashboardWidgetDataId[], limit = 5) {
  return useQuery({
    queryKey: queryKeys.dashboard.widgetData(ids, limit),
    queryFn: () => getDashboardWidgetData(ids, limit),
    enabled: ids.length > 0,
  })
}

export function useDashboardCalendarQuery(from?: string, to?: string) {
  return useQuery({ queryKey: queryKeys.dashboard.calendar(from, to), queryFn: () => getDashboardCalendar(from, to) })
}

export function useDashboardActivityQuery(limit = 20) {
  return useQuery({ queryKey: queryKeys.dashboard.activity(limit), queryFn: () => getDashboardActivity(limit) })
}

export function useDashboardPerformanceQuery(from?: string, to?: string) {
  return useQuery({ queryKey: queryKeys.dashboard.performance(from, to), queryFn: () => getDashboardPerformance(from, to) })
}

// PRD §10.3 - tenant-admin-only default layout configuration. Lives here (not `modules/settings`)
// since it operates on dashboard-owned data - `DashboardDefaultsSettingsPage` imports these.
export function useDashboardTenantDefaultsQuery(enabled = true) {
  return useQuery({ queryKey: queryKeys.dashboard.tenantDefaults, queryFn: getDashboardTenantDefaults, enabled })
}

export function useUpdateDashboardTenantDefaultMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ role, widgets }: { role: string; widgets: WidgetPreference[] }) => updateDashboardTenantDefault(role, widgets),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.dashboard.tenantDefaults }),
  })
}

export function useDeleteDashboardTenantDefaultMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (role: string) => deleteDashboardTenantDefault(role),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.dashboard.tenantDefaults }),
  })
}

export interface DashboardLayoutEntry {
  widget: Widget
  visible: boolean
  /** PRD §10.2/§10.4 - per-widget layout overrides. `size` absent means "use the widget's registry default." */
  size?: WidgetPreference['size']
  collapsed: boolean
  pinned: boolean
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
      if (widget) {
        ordered.push({ widget, visible: pref.visible, size: pref.size, collapsed: !!pref.collapsed, pinned: !!pref.pinned })
      }
    }
    for (const widget of permittedWidgets) {
      if (!savedIds.has(widget.id)) ordered.push({ widget, visible: true, collapsed: false, pinned: false })
    }
    return ordered
  }, [data, permittedWidgets])

  return {
    entries,
    isLoading,
    isError,
    source: data?.source ?? 'registry',
    refreshIntervalSeconds: data?.refreshIntervalSeconds ?? null,
  }
}
