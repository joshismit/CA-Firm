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
  DashboardPreferences,
  RevenueDatum,
  UpdateDashboardPreferencesPayload,
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
