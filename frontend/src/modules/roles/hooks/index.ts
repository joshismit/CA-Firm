// roles-scoped React hooks - data-fetching wrappers (TanStack Query) and local UI state.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/query-keys'
import { assignRole, createRole, deleteRole, getRole, listRoles, revokeRole, updateRole } from '../api'
import type { AssignRolePayload, CreateRolePayload, RoleListFilters, UpdateRolePayload } from '../types'

export function useRolesQuery(filters: RoleListFilters) {
  return useQuery({ queryKey: queryKeys.roles.list(filters), queryFn: () => listRoles(filters) })
}

export function useRoleQuery(id: string) {
  return useQuery({ queryKey: queryKeys.roles.detail(id), queryFn: () => getRole(id), enabled: !!id })
}

export function useCreateRoleMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateRolePayload) => createRole(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.roles.lists() }),
  })
}

export function useUpdateRoleMutation(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateRolePayload) => updateRole(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.roles.detail(id) })
      qc.invalidateQueries({ queryKey: queryKeys.roles.lists() })
    },
  })
}

export function useDeleteRoleMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.roles.lists() }),
  })
}

export function useAssignRoleMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: AssignRolePayload) => assignRole(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.roles.all }),
  })
}

export function useRevokeRoleMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: AssignRolePayload) => revokeRole(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.roles.all }),
  })
}
