// roles-scoped React hooks - data-fetching wrappers (TanStack Query) and local UI state.
// retry: false everywhere - a 501 NOT_IMPLEMENTED will never succeed on retry (same convention as
// modules/compliance, modules/client-billing, modules/notifications, modules/reports, modules/audit,
// modules/settings, modules/users).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/query-keys'
import { assignRole, createRole, deleteRole, getRole, getRoleUsers, listRoles, revokeRole, updateRole } from '../api'
import type { AssignRolePayload, CreateRolePayload, RoleListFilters, UpdateRolePayload } from '../types'

export function useRolesQuery(filters: RoleListFilters) {
  return useQuery({ queryKey: queryKeys.roles.list(filters), queryFn: () => listRoles(filters), retry: false })
}

export function useRoleQuery(id: string) {
  return useQuery({ queryKey: queryKeys.roles.detail(id), queryFn: () => getRole(id), enabled: !!id, retry: false })
}

export function useRoleUsersQuery(id: string) {
  return useQuery({ queryKey: queryKeys.roles.users(id), queryFn: () => getRoleUsers(id), enabled: !!id, retry: false })
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
