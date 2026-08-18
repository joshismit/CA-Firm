// Compliance API request functions, built on the shared Axios instance from src/services/axios.ts.
// Hits the real backend at ${env.apiBaseUrl}/${moduleKey} (backend/src/modules/compliance/routes/
// compliance-filing.routes.ts, mounted once per category at /gst, /itr, /tds, /mca) - mirrors
// modules/contacts/api/index.ts now that the Compliance backend module exists. The `/${moduleKey}`
// base this file already called before the backend existed turned out to be the real, confirmed
// contract (not a guess that needed changing).
import { apiClient } from '@/services/axios'
import type { ApiResponse, PaginatedResponse } from '@/types/api.types'
import type {
  ComplianceFiling,
  ComplianceFilingListFilters,
  ComplianceModuleKey,
  CreateComplianceFilingPayload,
  UpdateComplianceFilingPayload,
} from '../types'

export async function listComplianceFilings(
  moduleKey: ComplianceModuleKey,
  filters: ComplianceFilingListFilters
): Promise<PaginatedResponse<ComplianceFiling>> {
  const { data } = await apiClient.get<PaginatedResponse<ComplianceFiling>>(`/${moduleKey}`, { params: filters })
  return data
}

export async function getComplianceFiling(moduleKey: ComplianceModuleKey, id: string): Promise<ComplianceFiling> {
  const { data } = await apiClient.get<ApiResponse<ComplianceFiling>>(`/${moduleKey}/${id}`)
  return data.data
}

export async function createComplianceFiling(
  moduleKey: ComplianceModuleKey,
  payload: CreateComplianceFilingPayload
): Promise<ComplianceFiling> {
  const { data } = await apiClient.post<ApiResponse<ComplianceFiling>>(`/${moduleKey}`, payload)
  return data.data
}

export async function updateComplianceFiling(
  moduleKey: ComplianceModuleKey,
  id: string,
  payload: UpdateComplianceFilingPayload
): Promise<ComplianceFiling> {
  const { data } = await apiClient.patch<ApiResponse<ComplianceFiling>>(`/${moduleKey}/${id}`, payload)
  return data.data
}

export async function deleteComplianceFiling(moduleKey: ComplianceModuleKey, id: string): Promise<void> {
  await apiClient.delete(`/${moduleKey}/${id}`)
}
