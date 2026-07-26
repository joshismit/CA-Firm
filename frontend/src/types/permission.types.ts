// Permission and role type definitions consumed by the ACL layer and <Can>.
// Permission strings are `resource:action` (e.g. "tasks:create"), matching
// backend/src/shared/enums/permission.enum.ts exactly. Never branch on role name.

export type PermissionString = string

export type RoleTypeKind = 'SYSTEM' | 'CUSTOM'

export interface RoleInfo {
  id: string
  name: string
  description?: string | null
  type: RoleTypeKind
  permissions: PermissionString[]
}
