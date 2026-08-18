// compliance-scoped React hooks - data-fetching wrappers (TanStack Query) shared by all four
// Compliance areas.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/query-keys'
import {
  createComplianceFiling,
  deleteComplianceFiling,
  getComplianceFiling,
  listComplianceFilings,
  updateComplianceFiling,
} from '../api'
import type {
  ComplianceFilingListFilters,
  ComplianceModuleKey,
  CreateComplianceFilingPayload,
  UpdateComplianceFilingPayload,
} from '../types'

export function useComplianceFilingsQuery(moduleKey: ComplianceModuleKey, filters: ComplianceFilingListFilters) {
  return useQuery({
    queryKey: queryKeys.compliance.list(moduleKey, filters),
    queryFn: () => listComplianceFilings(moduleKey, filters),
  })
}

export function useComplianceFilingQuery(moduleKey: ComplianceModuleKey, id: string) {
  return useQuery({
    queryKey: queryKeys.compliance.detail(moduleKey, id),
    queryFn: () => getComplianceFiling(moduleKey, id),
    enabled: !!id,
  })
}

export function useCreateComplianceFilingMutation(moduleKey: ComplianceModuleKey) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateComplianceFilingPayload) => createComplianceFiling(moduleKey, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.compliance.lists(moduleKey) }),
  })
}

export function useUpdateComplianceFilingMutation(moduleKey: ComplianceModuleKey, id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateComplianceFilingPayload) => updateComplianceFiling(moduleKey, id, payload),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.compliance.detail(moduleKey, id), updated)
      qc.invalidateQueries({ queryKey: queryKeys.compliance.lists(moduleKey) })
    },
  })
}

export function useDeleteComplianceFilingMutation(moduleKey: ComplianceModuleKey) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteComplianceFiling(moduleKey, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.compliance.lists(moduleKey) }),
  })
}
