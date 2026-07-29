// TypeScript types and interfaces scoped to roles.
// Field shapes mirror the Role/RolePermission/UserRole Prisma models - the backend has a full
// RBAC schema but no mounted routes for managing it yet.

export type RoleType = 'SYSTEM' | 'CUSTOM'

export interface Role {
  id: string
  name: string
  description: string | null
  color: string | null
  type: RoleType
  isActive: boolean
  /** `resource:action` strings, matching config/permissions.config.ts's registry. */
  permissionCodes: string[]
  createdAt: string
  updatedAt: string
}

export interface RoleListFilters {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  search?: string
  type?: RoleType
}

export interface CreateRolePayload {
  name: string
  description?: string
  color?: string
  permissionCodes: string[]
}

export type UpdateRolePayload = Partial<CreateRolePayload>

export interface AssignRolePayload {
  userId: string
  roleId: string
  expiresAt?: string
}
