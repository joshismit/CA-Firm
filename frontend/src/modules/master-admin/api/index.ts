// master-admin API request functions, built on the shared Axios instance from src/services/axios.ts.
// Hits the real backend at ${env.apiBaseUrl}/master-admin (backend/src/modules/master-admin) - the
// platform-level tenant-management module now exists, mirroring modules/business/api/index.ts.

import { apiClient } from '@/services/axios'
import type { ApiError } from '@/services/api-error'
import type { ApiResponse, PaginatedResponse } from '@/types/api.types'
import type {
  MasterAdminLoginRequest,
  MasterAdminLoginResponse,
  SubscriptionPlan,
  Tenant,
  TenantDetail,
  TenantListFilters,
  UpdateTenantLimitsPayload,
  UpdateTenantStatusPayload,
} from '../types'

export async function masterAdminLoginRequest(payload: MasterAdminLoginRequest): Promise<MasterAdminLoginResponse> {
  const { data } = await apiClient.post<ApiResponse<MasterAdminLoginResponse>>('/master-admin/auth/login', payload)
  return data.data
}

export async function listTenants(filters: TenantListFilters): Promise<PaginatedResponse<Tenant>> {
  const { data } = await apiClient.get<PaginatedResponse<Tenant>>('/master-admin/tenants', { params: filters })
  return data
}

export async function getTenant(id: string): Promise<TenantDetail> {
  const { data } = await apiClient.get<ApiResponse<TenantDetail>>(`/master-admin/tenants/${id}`)
  return data.data
}

export async function updateTenantStatus(id: string, payload: UpdateTenantStatusPayload): Promise<TenantDetail> {
  const { data } = await apiClient.patch<ApiResponse<TenantDetail>>(`/master-admin/tenants/${id}/status`, payload)
  return data.data
}

export async function updateTenantLimits(id: string, payload: UpdateTenantLimitsPayload): Promise<TenantDetail> {
  const { data } = await apiClient.patch<ApiResponse<TenantDetail>>(`/master-admin/tenants/${id}/limits`, payload)
  return data.data
}

// ─── NOT YET AVAILABLE (no platform-level Subscription/Plan backend model exists) ──────────────
// Same notImplemented()/ApiError(501) shape as every other stub module (see modules/compliance/
// api/index.ts). This is the SaaS-subscription-billing scope (PRD §12, Razorpay/plans/trial) - a
// separate, still-unbuilt initiative from the tenant management above.

function notImplemented(action: string): never {
  throw {
    status: 501,
    code: 'NOT_IMPLEMENTED',
    message: `Master Admin API is not available yet (${action}).`,
  } satisfies ApiError
}

// TODO: GET /master-admin/subscriptions/plans
export async function listSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  return notImplemented('listSubscriptionPlans')
}
