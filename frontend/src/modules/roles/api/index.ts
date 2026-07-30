// roles API request functions, built on the shared Axios instance from src/services/axios.ts.
// Hits the real backend at ${env.apiBaseUrl}/roles (backend/src/modules/roles/routes/role.routes.ts) -
// mirrors modules/users/api/index.ts now that the Roles backend module exists.

import { apiClient } from '@/services/axios'
import type { ApiResponse, PaginatedResponse } from '@/types/api.types'
import type { User } from '@/modules/users/types'
import type { AssignRolePayload, CreateRolePayload, Role, RoleListFilters, UpdateRolePayload } from '../types'

export async function listRoles(filters: RoleListFilters): Promise<PaginatedResponse<Role>> {
  const { data } = await apiClient.get<PaginatedResponse<Role>>('/roles', { params: filters })
  return data
}

export async function getRole(id: string): Promise<Role> {
  const { data } = await apiClient.get<ApiResponse<Role>>(`/roles/${id}`)
  return data.data
}

export async function createRole(payload: CreateRolePayload): Promise<Role> {
  const { data } = await apiClient.post<ApiResponse<Role>>('/roles', payload)
  return data.data
}

export async function updateRole(id: string, payload: UpdateRolePayload): Promise<Role> {
  const { data } = await apiClient.patch<ApiResponse<Role>>(`/roles/${id}`, payload)
  return data.data
}

export async function deleteRole(id: string): Promise<void> {
  await apiClient.delete(`/roles/${id}`)
}

export async function assignRole(payload: AssignRolePayload): Promise<void> {
  await apiClient.post('/roles/assign', payload)
}

export async function revokeRole(payload: AssignRolePayload): Promise<void> {
  await apiClient.post('/roles/revoke', payload)
}

export async function getRoleUsers(roleId: string): Promise<User[]> {
  const { data } = await apiClient.get<ApiResponse<User[]>>(`/roles/${roleId}/users`)
  return data.data
}
