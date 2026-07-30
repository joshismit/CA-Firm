// users-scoped React hooks - data-fetching wrappers (TanStack Query) and local UI state.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/query-keys'
import {
  deleteUser,
  getUser,
  getUserRoles,
  getUserSessions,
  inviteUser,
  listUsers,
  resendInvitation,
  revokeInvitation,
  updateUser,
} from '../api'
import type { InviteUserPayload, UpdateUserPayload, UserListFilters } from '../types'

export function useUsersQuery(filters: UserListFilters) {
  return useQuery({ queryKey: queryKeys.users.list(filters), queryFn: () => listUsers(filters) })
}

export function useUserQuery(id: string) {
  return useQuery({ queryKey: queryKeys.users.detail(id), queryFn: () => getUser(id), enabled: !!id })
}

export function useUserRolesQuery(id: string) {
  return useQuery({ queryKey: queryKeys.users.roles(id), queryFn: () => getUserRoles(id), enabled: !!id })
}

export function useUserSessionsQuery(id: string) {
  return useQuery({ queryKey: queryKeys.users.sessions(id), queryFn: () => getUserSessions(id), enabled: !!id })
}

export function useInviteUserMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: InviteUserPayload) => inviteUser(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.users.lists() }),
  })
}

export function useUpdateUserMutation(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateUserPayload) => updateUser(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.users.detail(id) })
      qc.invalidateQueries({ queryKey: queryKeys.users.lists() })
    },
  })
}

export function useDeleteUserMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.users.lists() }),
  })
}

export function useResendInvitationMutation() {
  return useMutation({ mutationFn: (invitationId: string) => resendInvitation(invitationId) })
}

export function useRevokeInvitationMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (invitationId: string) => revokeInvitation(invitationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.users.lists() }),
  })
}
