// reports API request functions, built on the shared Axios instance from src/services/axios.ts.
// Hits the real backend at ${env.apiBaseUrl}/reports/:type[/export] (backend/src/modules/reports/
// routes/report.routes.ts) - mirrors modules/compliance/api/index.ts now that the Reports backend
// module exists. exportReport uses responseType: 'blob' since the backend returns a raw file body
// (text/csv), not a JSON envelope - matches this function's own Promise<Blob> return type exactly.
import { apiClient } from '@/services/axios'
import type { ApiResponse } from '@/types/api.types'
import type { ReportExportFormat, ReportFilters, ReportResult, ReportType } from '../types'

export async function generateReport(type: ReportType, filters: ReportFilters): Promise<ReportResult> {
  const { data } = await apiClient.get<ApiResponse<ReportResult>>(`/reports/${type}`, { params: filters })
  return data.data
}

export async function exportReport(type: ReportType, filters: ReportFilters, format: ReportExportFormat): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`/reports/${type}/export`, {
    params: { ...filters, format },
    responseType: 'blob',
  })
  return data
}
