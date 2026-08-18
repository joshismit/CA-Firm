// crm-scoped React hooks - data-fetching wrappers (TanStack Query) and local UI state.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/query-keys'
import { convertLead, createLead, deleteLead, getLead, listLeadStages, listLeads, updateLead } from '../api'
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

/**
 * Board-level stage move (Kanban drag-and-drop, or the keyboard-accessible "Move to" select) -
 * `id` travels in the mutation's variables instead of being bound at hook-call time like
 * useUpdateLeadMutation, since a single board handles moves for many leads. Reuses the existing
 * updateLead()/PATCH endpoint - no new API surface.
 */
export function useMoveLeadStageMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, stageId }: { id: string; stageId: string }) => updateLead(id, { stageId }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.detail(variables.id) })
      qc.invalidateQueries({ queryKey: queryKeys.crm.lists() })
    },
  })
}

export function useDeleteLeadMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteLead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.crm.lists() }),
  })
}

export function useConvertLeadMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ConvertLeadPayload) => convertLead(payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.detail(variables.leadId) })
      qc.invalidateQueries({ queryKey: queryKeys.crm.lists() })
    },
  })
}
