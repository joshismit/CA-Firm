// crm-scoped React hooks - data-fetching wrappers (TanStack Query) and local UI state.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/query-keys'
import { convertLead, createLead, getLead, listLeadStages, listLeads, updateLead } from '../api'
import type { ConvertLeadPayload, CreateLeadPayload, LeadListFilters, UpdateLeadPayload } from '../types'

export function useLeadsQuery(filters: LeadListFilters) {
  return useQuery({ queryKey: queryKeys.crm.list(filters), queryFn: () => listLeads(filters) })
}

export function useLeadQuery(id: string) {
  return useQuery({ queryKey: queryKeys.crm.detail(id), queryFn: () => getLead(id), enabled: !!id })
}

export function useLeadStagesQuery() {
  return useQuery({ queryKey: queryKeys.crm.stages, queryFn: listLeadStages })
}

export function useCreateLeadMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateLeadPayload) => createLead(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.crm.lists() }),
  })
}

export function useUpdateLeadMutation(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateLeadPayload) => updateLead(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.detail(id) })
      qc.invalidateQueries({ queryKey: queryKeys.crm.lists() })
    },
  })
}

export function useConvertLeadMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ConvertLeadPayload) => convertLead(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.crm.lists() }),
  })
}
