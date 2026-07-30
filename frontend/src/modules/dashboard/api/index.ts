// dashboard API request functions, built on the shared Axios instance from src/services/axios.ts.
//
// NOT YET AVAILABLE: analytics depend on a reporting/analytics backend that doesn't exist yet
// (same gap documented in modules/reports/api/index.ts - revenue, filing, and client-growth data
// has no API behind it). Every function below is a typed placeholder - wire the real apiClient
// call once the backend implements analytics endpoints. No mock data, no guessed endpoint path.

import type { ApiError } from '@/services/api-error'
import type { AnalyticsFilters, AnalyticsSummary, ClientGrowthDatum, RevenueDatum } from '../types'

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
