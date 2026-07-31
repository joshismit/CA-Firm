// master-admin-scoped React hooks - data-fetching wrappers (TanStack Query) and local UI state.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { queryKeys } from '@/services/query-keys'
import { useAuthStore } from '@/store/auth.store'
import { getTenant, listTenants, masterAdminLoginRequest, updateTenantLimits, updateTenantStatus } from '../api'
import type { TenantListFilters, UpdateTenantLimitsPayload, UpdateTenantStatusPayload } from '../types'

// Real endpoints (backend/src/modules/master-admin) - not NOT_IMPLEMENTED stubs.

export function useMasterAdminLoginMutation() {
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()

  return useMutation({
    mutationFn: masterAdminLoginRequest,
    onSuccess: (data) => {
      // No refresh token for a master admin session (see MasterAdmin's header comment in
      // schema.prisma) - the empty string keeps the interceptor's refresh-retry branch a no-op,
      // so a lapsed token just hard-logs-out instead of looping.
      login(data.accessToken, '', { ...data.admin, role: 'MASTER_ADMIN', permissions: [] })
      navigate('/master-admin', { replace: true })
    },
  })
}

export function useTenantsQuery(filters: TenantListFilters) {
  return useQuery({
    queryKey: queryKeys.masterAdmin.tenantsList(filters),
    queryFn: () => listTenants(filters),
  })
}

export function useTenantQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.masterAdmin.tenantDetail(id),
    queryFn: () => getTenant(id),
    enabled: !!id,
  })
}

export function useUpdateTenantStatusMutation(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateTenantStatusPayload) => updateTenantStatus(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.masterAdmin.tenantDetail(id) })
      qc.invalidateQueries({ queryKey: queryKeys.masterAdmin.tenants })
    },
  })
}

export function useUpdateTenantLimitsMutation(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateTenantLimitsPayload) => updateTenantLimits(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.masterAdmin.tenantDetail(id) })
      qc.invalidateQueries({ queryKey: queryKeys.masterAdmin.tenants })
    },
  })
}

// Plan catalog queries/mutations (useAdminPlansQuery etc.) live in @/modules/billing/hooks -
// that module owns `Plan` end-to-end (see backend/src/modules/billing/index.ts's header comment).
