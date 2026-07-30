// master-admin-scoped React hooks - data-fetching wrappers (TanStack Query) and local UI state.
// `retry: false` on every query - the underlying API is a guaranteed 501 today (see api/index.ts).

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/services/query-keys'
import { listSubscriptionPlans, listTenants } from '../api'
import type { TenantListFilters } from '../types'

export function useTenantsQuery(filters: TenantListFilters) {
  return useQuery({
    queryKey: queryKeys.masterAdmin.tenantsList(filters),
    queryFn: () => listTenants(filters),
    retry: false,
  })
}

export function useSubscriptionPlansQuery() {
  return useQuery({
    queryKey: queryKeys.masterAdmin.plans,
    queryFn: () => listSubscriptionPlans(),
    retry: false,
  })
}
