// dashboard API request functions, built on the shared Axios instance from src/services/axios.ts.
//
// getDashboardPreferences/updateDashboardPreferences below are real, backed by
// backend/src/modules/dashboard. The analytics functions further down are NOT: they depend on a
// reporting/analytics backend that doesn't exist yet (same gap documented in
// modules/reports/api/index.ts - revenue, filing, and client-growth data has no API behind it).
// Each analytics function is a typed placeholder - wire the real apiClient call once the backend
// implements analytics endpoints. No mock data, no guessed endpoint path.

import { apiClient } from '@/services/axios'
import type { ApiError } from '@/services/api-error'
import type { ApiResponse } from '@/types/api.types'
import type {
  AnalyticsFilters,
  AnalyticsSummary,
  ClientGrowthDatum,
  DashboardActivity,
  DashboardCalendar,
  DashboardOverview,
  DashboardPerformance,
  DashboardPreferences,
  DashboardTenantDefault,
  DashboardWidgetDataId,
  DashboardWidgetDataResponse,
  RevenueDatum,
  UpdateDashboardPreferencesPayload,
  WidgetPreference,
} from '../types'

// Backed by a real endpoint, unlike the analytics placeholders below - hits
// GET/PATCH /dashboard/preferences (backend/src/modules/dashboard/routes/dashboard-preference.routes.ts).
export async function getDashboardPreferences(): Promise<DashboardPreferences> {
  const { data } = await apiClient.get<ApiResponse<DashboardPreferences>>('/dashboard/preferences')
  return data.data
}

export async function updateDashboardPreferences(payload: UpdateDashboardPreferencesPayload): Promise<DashboardPreferences> {
  const { data } = await apiClient.patch<ApiResponse<DashboardPreferences>>('/dashboard/preferences', payload)
  return data.data
}

// PRD §10.4 "Restore Defaults" - deletes the caller's personal layout row; the response reflects
// whatever the fallback chain resolves to next (tenant/role default, or the registry default).
export async function resetDashboardPreferences(): Promise<DashboardPreferences> {
  const { data } = await apiClient.post<ApiResponse<DashboardPreferences>>('/dashboard/preferences/reset')
  return data.data
}

// PRD §10.10 - real aggregation endpoints (backend/src/modules/dashboard/routes/dashboard.routes.ts).
export async function getDashboardOverview(): Promise<DashboardOverview> {
  const { data } = await apiClient.get<ApiResponse<DashboardOverview>>('/dashboard')
  return data.data
}

export async function getDashboardWidgetData(ids: DashboardWidgetDataId[], limit = 5): Promise<DashboardWidgetDataResponse> {
  const { data } = await apiClient.get<ApiResponse<DashboardWidgetDataResponse>>('/dashboard/widgets', {
    params: { ids: ids.join(','), limit },
  })
  return data.data
}

export async function getDashboardCalendar(from?: string, to?: string): Promise<DashboardCalendar> {
  const { data } = await apiClient.get<ApiResponse<DashboardCalendar>>('/dashboard/calendar', { params: { from, to } })
  return data.data
}

export async function getDashboardActivity(limit = 20): Promise<DashboardActivity> {
  const { data } = await apiClient.get<ApiResponse<DashboardActivity>>('/dashboard/activity', { params: { limit } })
  return data.data
}

export async function getDashboardPerformance(from?: string, to?: string): Promise<DashboardPerformance> {
  const { data } = await apiClient.get<ApiResponse<DashboardPerformance>>('/dashboard/performance', { params: { from, to } })
  return data.data
}

// PRD §10.3 - tenant-admin-only default layout configuration.
export async function getDashboardTenantDefaults(): Promise<DashboardTenantDefault[]> {
  const { data } = await apiClient.get<ApiResponse<DashboardTenantDefault[]>>('/dashboard/tenant-defaults')
  return data.data
}

export async function updateDashboardTenantDefault(role: string, widgets: WidgetPreference[]): Promise<DashboardTenantDefault> {
  const { data } = await apiClient.put<ApiResponse<DashboardTenantDefault>>(`/dashboard/tenant-defaults/${role}`, { widgets })
  return data.data
}

export async function deleteDashboardTenantDefault(role: string): Promise<void> {
  await apiClient.delete(`/dashboard/tenant-defaults/${role}`)
}

function notImplemented(action: string): never {
  throw {
    status: 501,
    code: 'NOT_IMPLEMENTED',
    message: `Analytics API is not available yet (${action}).`,
  } satisfies ApiError
}

// TODO: GET /api/v1/analytics/summary
export async function getAnalyticsSummary(_filters: AnalyticsFilters): Promise<AnalyticsSummary> {
  return notImplemented('getAnalyticsSummary')
}

// TODO: GET /api/v1/analytics/revenue-trend
export async function getRevenueTrend(_filters: AnalyticsFilters): Promise<RevenueDatum[]> {
  return notImplemented('getRevenueTrend')
}

// TODO: GET /api/v1/analytics/client-growth
export async function getClientGrowthTrend(_filters: AnalyticsFilters): Promise<ClientGrowthDatum[]> {
  return notImplemented('getClientGrowthTrend')
}
