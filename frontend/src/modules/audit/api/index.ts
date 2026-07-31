// audit API request functions, built on the shared Axios instance from src/services/axios.ts.
// Hits the real backend at ${env.apiBaseUrl}/audit-logs (backend/src/modules/audit/routes/
// audit-log.routes.ts) - mirrors modules/notifications/api/index.ts now that the Audit Logs
// backend module exists (PRD section 14.1).
import { apiClient } from '@/services/axios'
import type { ApiResponse, PaginatedResponse } from '@/types/api.types'
import type { AuditLogEntry, AuditLogFilters } from '../types'

export async function listAuditLogs(filters: AuditLogFilters): Promise<PaginatedResponse<AuditLogEntry>> {
  const { data } = await apiClient.get<PaginatedResponse<AuditLogEntry>>('/audit-logs', { params: filters })
  return data
}

export async function getAuditLogEntry(id: string): Promise<AuditLogEntry> {
  const { data } = await apiClient.get<ApiResponse<AuditLogEntry>>(`/audit-logs/${id}`)
  return data.data
}
