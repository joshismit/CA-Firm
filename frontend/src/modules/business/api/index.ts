// business API request functions, built on the shared Axios instance from src/services/axios.ts.
// Hits the real backend at ${env.apiBaseUrl}/business (backend/src/modules/business/routes/business.routes.ts) -
// mirrors modules/projects/api/index.ts now that the Business backend module exists.

import { apiClient } from '@/services/axios'
import type { ApiResponse, PaginatedResponse } from '@/types/api.types'
import type {
  Business,
  BusinessListFilters,
  BusinessType,
  CreateBusinessPayload,
  UpdateBusinessPayload,
} from '../types'

export async function listBusinesses(filters: BusinessListFilters): Promise<PaginatedResponse<Business>> {
  const { data } = await apiClient.get<PaginatedResponse<Business>>('/business', { params: filters })
  return data
}

export async function getBusiness(id: string): Promise<Business> {
  const { data } = await apiClient.get<ApiResponse<Business>>(`/business/${id}`)
  return data.data
}

export async function listBusinessTypes(): Promise<BusinessType[]> {
  const { data } = await apiClient.get<ApiResponse<BusinessType[]>>('/business/types')
  return data.data
}

export async function createBusiness(payload: CreateBusinessPayload): Promise<Business> {
  const { data } = await apiClient.post<ApiResponse<Business>>('/business', payload)
  return data.data
}

export async function updateBusiness(id: string, payload: UpdateBusinessPayload): Promise<Business> {
  const { data } = await apiClient.patch<ApiResponse<Business>>(`/business/${id}`, payload)
  return data.data
}

export async function deleteBusiness(id: string): Promise<void> {
  await apiClient.delete(`/business/${id}`)
}
