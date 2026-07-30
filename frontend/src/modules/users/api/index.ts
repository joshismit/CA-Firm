// users API request functions, built on the shared Axios instance from src/services/axios.ts.
// Hits the real backend at ${env.apiBaseUrl}/users (backend/src/modules/users/routes/user.routes.ts) -
// mirrors modules/contacts/api/index.ts now that the Users backend module exists.

import { apiClient } from '@/services/axios'
import type { ApiResponse, PaginatedResponse } from '@/types/api.types'
import type { AuthSession } from '@/modules/auth/types'
import type { Role } from '@/modules/roles/types'
import type { InviteUserPayload, UpdateUserPayload, User, UserInvitation, UserListFilters } from '../types'

export async function listUsers(filters: UserListFilters): Promise<PaginatedResponse<User>> {
  const { data } = await apiClient.get<PaginatedResponse<User>>('/users', { params: filters })
  return data
}

export async function getUser(id: string): Promise<User> {
  const { data } = await apiClient.get<ApiResponse<User>>(`/users/${id}`)
  return data.data
}

export async function inviteUser(payload: InviteUserPayload): Promise<UserInvitation> {
  const { data } = await apiClient.post<ApiResponse<UserInvitation>>('/users/invite', payload)
  return data.data
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<User> {
  const { data } = await apiClient.patch<ApiResponse<User>>(`/users/${id}`, payload)
  return data.data
}

export async function deleteUser(id: string): Promise<void> {
  await apiClient.delete(`/users/${id}`)
}

export async function resendInvitation(invitationId: string): Promise<void> {
  await apiClient.post(`/users/invitations/${invitationId}/resend`)
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  await apiClient.delete(`/users/invitations/${invitationId}`)
}

export async function getUserRoles(userId: string): Promise<Role[]> {
  const { data } = await apiClient.get<ApiResponse<Role[]>>(`/users/${userId}/roles`)
  return data.data
}

// Deliberately distinct from the real, self-service GET /auth/sessions (modules/auth) - that
// endpoint always returns the *caller's own* sessions with no userId param, so it cannot be reused
// here to show an arbitrary user's sessions to an admin. This is a separate, admin-facing endpoint.
export async function getUserSessions(userId: string): Promise<AuthSession[]> {
  const { data } = await apiClient.get<ApiResponse<AuthSession[]>>(`/users/${userId}/sessions`)
  return data.data
}
