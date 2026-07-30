// permissions API request functions, built on the shared Axios instance from src/services/axios.ts.
// Hits the real backend at ${env.apiBaseUrl}/permissions (backend/src/modules/permissions/routes/permission.routes.ts) -
// mirrors modules/roles/api/index.ts now that the Permissions backend module exists.

import { apiClient } from '@/services/axios'
import type { ApiResponse } from '@/types/api.types'
import type { Permission, PermissionGroup, PermissionMatrixEntry, UpdatePermissionMatrixPayload } from '../types'

export async function listPermissions(): Promise<Permission[]> {
  const { data } = await apiClient.get<ApiResponse<Permission[]>>('/permissions')
  return data.data
}

export async function listPermissionGroups(): Promise<PermissionGroup[]> {
  const { data } = await apiClient.get<ApiResponse<PermissionGroup[]>>('/permissions/groups')
  return data.data
}

export async function getPermissionMatrix(roleId: string): Promise<PermissionMatrixEntry[]> {
  const { data } = await apiClient.get<ApiResponse<PermissionMatrixEntry[]>>(`/permissions/matrix/${roleId}`)
  return data.data
}

export async function updatePermissionMatrix(payload: UpdatePermissionMatrixPayload): Promise<void> {
  await apiClient.patch('/permissions/matrix', payload)
}
