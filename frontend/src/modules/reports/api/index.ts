// reports API request functions, built on the shared Axios instance from src/services/axios.ts.
//
// NOT YET AVAILABLE: reports depend on Business/CRM/Documents/Billing data that doesn't have
// real backend routes yet either. Every function below is a typed placeholder - wire the real
// apiClient call once the backend implements reporting endpoints. No mock data, no guessed
// endpoint path.

import type { ApiError } from '@/services/api-error'
import type { ReportExportFormat, ReportFilters, ReportResult, ReportType } from '../types'

function notImplemented(action: string): never {
  throw {
    status: 501,
    code: 'NOT_IMPLEMENTED',
    message: `Reports API is not available yet (${action}).`,
  } satisfies ApiError
}

// TODO: GET /api/v1/reports/:type
export async function generateReport(_type: ReportType, _filters: ReportFilters): Promise<ReportResult> {
  return notImplemented('generateReport')
}

// TODO: GET /api/v1/reports/:type/export
export async function exportReport(_type: ReportType, _filters: ReportFilters, _format: ReportExportFormat): Promise<Blob> {
  return notImplemented('exportReport')
}
