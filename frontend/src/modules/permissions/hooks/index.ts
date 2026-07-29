// permissions-scoped React hooks - data-fetching wrappers (TanStack Query) and local UI state.
// retry: false everywhere - a 501 NOT_IMPLEMENTED will never succeed on retry (same convention as
// modules/compliance, modules/client-billing, modules/notifications, modules/reports, modules/audit,
// modules/settings, modules/users, modules/roles).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/query-keys'
import { getPermissionMatrix, listPermissionGroups, listPermissions, updatePermissionMatrix } from '../api'
import type { UpdatePermissionMatrixPayload } from '../types'

export function usePermissionsQuery() {
  return useQuery({ queryKey: queryKeys.permissions.list, queryFn: listPermissions, retry: false })
}

export function usePermissionGroupsQuery() {
  return useQuery({ queryKey: queryKeys.permissions.groups, queryFn: listPermissionGroups, retry: false })
}

export function usePermissionMatrixQuery(roleId: string) {
  return useQuery({
    queryKey: queryKeys.permissions.matrix(roleId),
    queryFn: () => getPermissionMatrix(roleId),
    enabled: !!roleId,
    retry: false,
  })
}

export function useUpdatePermissionMatrixMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdatePermissionMatrixPayload) => updatePermissionMatrix(payload),
    onSuccess: (_data, variables) => qc.invalidateQueries({ queryKey: queryKeys.permissions.matrix(variables.roleId) }),
  })
}
