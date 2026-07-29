// crm API request functions, built on the shared Axios instance from src/services/axios.ts.
// Hits the real backend at ${env.apiBaseUrl}/crm (backend/src/modules/crm/routes/lead.routes.ts) -
// mirrors modules/business/api/index.ts and modules/contacts/api/index.ts now that the CRM backend
// module exists.

import { apiClient } from '@/services/axios'
import type { ApiResponse, PaginatedResponse } from '@/types/api.types'
import type {
  ConvertLeadPayload,
  CreateLeadPayload,
  Lead,
  LeadListFilters,
  LeadStage,
  UpdateLeadPayload,
} from '../types'

export async function listLeads(filters: LeadListFilters): Promise<PaginatedResponse<Lead>> {
  const { data } = await apiClient.get<PaginatedResponse<Lead>>('/crm', { params: filters })
  return data
}

export async function getLead(id: string): Promise<Lead> {
  const { data } = await apiClient.get<ApiResponse<Lead>>(`/crm/${id}`)
  return data.data
}

export async function listLeadStages(): Promise<LeadStage[]> {
  const { data } = await apiClient.get<ApiResponse<LeadStage[]>>('/crm/stages')
  return data.data
}

export async function createLead(payload: CreateLeadPayload): Promise<Lead> {
  const { data } = await apiClient.post<ApiResponse<Lead>>('/crm', payload)
  return data.data
}

export async function updateLead(id: string, payload: UpdateLeadPayload): Promise<Lead> {
  const { data } = await apiClient.patch<ApiResponse<Lead>>(`/crm/${id}`, payload)
  return data.data
}

export async function deleteLead(id: string): Promise<void> {
  await apiClient.delete(`/crm/${id}`)
}

/**
 * `leadId` addresses the URL (`POST /crm/:id/convert`) - only `notes` travels in the body, matching
 * backend/src/modules/crm/schemas/lead.schema.ts's `convertLeadSchema`. `ConvertLeadPayload` bundles
 * both for the caller's convenience; that's a client-side shape only.
 */
export async function convertLead(payload: ConvertLeadPayload): Promise<Lead> {
  const { data } = await apiClient.post<ApiResponse<Lead>>(`/crm/${payload.leadId}/convert`, {
    notes: payload.notes,
  })
  return data.data
}
