// permissions API request functions, built on the shared Axios instance from src/services/axios.ts.
//
// NOT YET AVAILABLE: backend/src/modules has no `permissions` module (no routes mounted in
// backend/src/app.ts), even though Permission/PermissionGroup are fully defined in Prisma. Every
// function below is a typed placeholder - wire the real apiClient call once the backend
// implements it. No mock data, no guessed endpoint path.

import type { ApiError } from '@/services/api-error'
import type { Permission, PermissionGroup, PermissionMatrixEntry, UpdatePermissionMatrixPayload } from '../types'

function notImplemented(action: string): never {
  throw {
    status: 501,
    code: 'NOT_IMPLEMENTED',
    message: `Permissions API is not available yet (${action}).`,
  } satisfies ApiError
}

// TODO: GET /api/v1/permissions
export async function listPermissions(): Promise<Permission[]> {
  return notImplemented('listPermissions')
}

// TODO: GET /api/v1/permissions/groups
export async function listPermissionGroups(): Promise<PermissionGroup[]> {
  return notImplemented('listPermissionGroups')
}

// TODO: GET /api/v1/permissions/matrix/:roleId
export async function getPermissionMatrix(_roleId: string): Promise<PermissionMatrixEntry[]> {
  return notImplemented('getPermissionMatrix')
}

// TODO: PATCH /api/v1/permissions/matrix
export async function updatePermissionMatrix(_payload: UpdatePermissionMatrixPayload): Promise<void> {
  return notImplemented('updatePermissionMatrix')
}
