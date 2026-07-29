// roles API request functions, built on the shared Axios instance from src/services/axios.ts.
//
// NOT YET AVAILABLE: backend/src/modules has no `roles` module (no routes mounted in
// backend/src/app.ts), even though Role/Permission/RolePermission/UserRole are fully defined in
// Prisma. Every function below is a typed placeholder - wire the real apiClient call once the
// backend implements it. No mock data, no guessed endpoint path.

import type { ApiError } from '@/services/api-error'
import type { PaginatedResponse } from '@/types/api.types'
import type { User } from '@/modules/users/types'
import type { AssignRolePayload, CreateRolePayload, Role, RoleListFilters, UpdateRolePayload } from '../types'

function notImplemented(action: string): never {
  throw {
    status: 501,
    code: 'NOT_IMPLEMENTED',
    message: `Roles API is not available yet (${action}).`,
  } satisfies ApiError
}

// TODO: GET /api/v1/roles
export async function listRoles(_filters: RoleListFilters): Promise<PaginatedResponse<Role>> {
  return notImplemented('listRoles')
}

// TODO: GET /api/v1/roles/:id
export async function getRole(_id: string): Promise<Role> {
  return notImplemented('getRole')
}

// TODO: POST /api/v1/roles
export async function createRole(_payload: CreateRolePayload): Promise<Role> {
  return notImplemented('createRole')
}

// TODO: PATCH /api/v1/roles/:id
export async function updateRole(_id: string, _payload: UpdateRolePayload): Promise<Role> {
  return notImplemented('updateRole')
}

// TODO: DELETE /api/v1/roles/:id
export async function deleteRole(_id: string): Promise<void> {
  return notImplemented('deleteRole')
}

// TODO: POST /api/v1/roles/assign
export async function assignRole(_payload: AssignRolePayload): Promise<void> {
  return notImplemented('assignRole')
}

// TODO: POST /api/v1/roles/revoke
export async function revokeRole(_payload: AssignRolePayload): Promise<void> {
  return notImplemented('revokeRole')
}

// TODO: GET /api/v1/roles/:id/users
export async function getRoleUsers(_roleId: string): Promise<User[]> {
  return notImplemented('getRoleUsers')
}
