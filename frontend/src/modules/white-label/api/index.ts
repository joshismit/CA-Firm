// white-label API request functions, built on the shared Axios instance from src/services/axios.ts.
// Hits the real backend at ${env.apiBaseUrl}/settings/branding, /settings/domain, and the public
// /public/white-label endpoint (backend/src/modules/tenant/routes/*.ts).
import { apiClient } from '@/services/axios'
import type { ApiResponse } from '@/types/api.types'
import type {
  TenantBranding,
  UpdateTenantBrandingPayload,
  BrandingAssetSlot,
  TenantDomain,
  CreateTenantDomainPayload,
  PublicBranding,
} from '../types'

export async function getBranding(): Promise<TenantBranding> {
  const { data } = await apiClient.get<ApiResponse<TenantBranding>>('/settings/branding')
  return data.data
}

export async function updateBranding(payload: UpdateTenantBrandingPayload): Promise<TenantBranding> {
  const { data } = await apiClient.patch<ApiResponse<TenantBranding>>('/settings/branding', payload)
  return data.data
}

export async function uploadBrandingAsset(slot: BrandingAssetSlot, file: File): Promise<TenantBranding> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('slot', slot)

  const { data } = await apiClient.post<ApiResponse<TenantBranding>>('/settings/branding/assets', formData)
  return data.data
}

export async function getDomain(): Promise<TenantDomain | null> {
  const { data } = await apiClient.get<ApiResponse<TenantDomain | null>>('/settings/domain')
  return data.data
}

export async function createDomain(payload: CreateTenantDomainPayload): Promise<TenantDomain> {
  const { data } = await apiClient.post<ApiResponse<TenantDomain>>('/settings/domain', payload)
  return data.data
}

export async function verifyDomain(): Promise<TenantDomain> {
  const { data } = await apiClient.post<ApiResponse<TenantDomain>>('/settings/domain/verify')
  return data.data
}

export async function deleteDomain(): Promise<void> {
  await apiClient.delete('/settings/domain')
}

/** No auth required — called by `AuthLayout` before any login has happened. */
export async function resolvePublicBranding(host: string): Promise<PublicBranding> {
  const { data } = await apiClient.get<ApiResponse<PublicBranding>>('/public/white-label', { params: { host } })
  return data.data
}
