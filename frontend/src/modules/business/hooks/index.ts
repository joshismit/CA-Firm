// business-scoped React hooks - data-fetching wrappers (TanStack Query) and local UI state.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/query-keys'
import { createBusiness, deleteBusiness, getBusiness, listBusinesses, listBusinessTypes, updateBusiness } from '../api'
import type { BusinessListFilters, CreateBusinessPayload, UpdateBusinessPayload } from '../types'

export function useBusinessesQuery(filters: BusinessListFilters) {
  return useQuery({ queryKey: queryKeys.business.list(filters), queryFn: () => listBusinesses(filters) })
}

export function useBusinessQuery(id: string) {
  return useQuery({ queryKey: queryKeys.business.detail(id), queryFn: () => getBusiness(id), enabled: !!id })
}

/** Shared (cross-tenant) reference data - long staleTime since the type catalog rarely changes. */
export function useBusinessTypesQuery() {
  return useQuery({
    queryKey: queryKeys.business.types,
    queryFn: listBusinessTypes,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateBusinessMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateBusinessPayload) => createBusiness(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.business.lists() }),
  })
}

export function useUpdateBusinessMutation(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateBusinessPayload) => updateBusiness(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.business.detail(id) })
      qc.invalidateQueries({ queryKey: queryKeys.business.lists() })
    },
  })
}

export function useDeleteBusinessMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteBusiness(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.business.lists() }),
  })
}
