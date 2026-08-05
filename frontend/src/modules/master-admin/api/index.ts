// master-admin API request functions, built on the shared Axios instance from src/services/axios.ts.
// Hits the real backend at ${env.apiBaseUrl}/master-admin (backend/src/modules/master-admin) - the
// platform-level tenant-management module now exists, mirroring modules/business/api/index.ts.

import { apiClient } from '@/services/axios'
import type { ApiResponse, PaginatedResponse } from '@/types/api.types'
import type {
  CreateTenantPayload,
  MasterAdminAuditLogEntry,
  MasterAdminAuditLogFilters,
  MasterAdminLoginRequest,
  MasterAdminLoginResponse,
  Tenant,
  TenantDetail,
  TenantListFilters,
  TenantUserOption,
  UpdateTenantLimitsPayload,
  UpdateTenantStatusPayload,
} from '../types'

export async function masterAdminLoginRequest(payload: MasterAdminLoginRequest): Promise<MasterAdminLoginResponse> {
  const { data } = await apiClient.post<ApiResponse<MasterAdminLoginResponse>>('/master-admin/auth/login', payload)
  return data.data
}

export async function createTenant(payload: CreateTenantPayload): Promise<TenantDetail> {
  const { data } = await apiClient.post<ApiResponse<TenantDetail>>('/master-admin/tenants', payload)
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

// Plan catalog management (GET/POST/PATCH /master-admin/plans) lives in @/modules/billing's api -
// that module owns `Plan` end-to-end (see backend/src/modules/billing/index.ts's header comment),
// this module just adds the role-gated route surface on top of it.

// ─── System-level audit monitoring (PRD §4.1) ──────────────────────────────────
// Hits the same backend Audit Logs feature as @/modules/audit's own api/index.ts, just the
// cross-tenant `/master-admin/audit-logs*` routes instead of the tenant-scoped `/audit-logs*` ones.

export async function listMasterAdminAuditLogs(filters: MasterAdminAuditLogFilters): Promise<PaginatedResponse<MasterAdminAuditLogEntry>> {
  const { data } = await apiClient.get<PaginatedResponse<MasterAdminAuditLogEntry>>('/master-admin/audit-logs', { params: filters })
  return data
}

export async function getMasterAdminAuditLogEntry(id: string): Promise<MasterAdminAuditLogEntry> {
  const { data } = await apiClient.get<ApiResponse<MasterAdminAuditLogEntry>>(`/master-admin/audit-logs/${id}`)
  return data.data
}

export async function listTenantUsers(tenantId: string): Promise<TenantUserOption[]> {
  const { data } = await apiClient.get<ApiResponse<TenantUserOption[]>>(`/master-admin/tenants/${tenantId}/users`)
  return data.data
}
