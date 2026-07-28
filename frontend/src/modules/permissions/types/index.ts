// TypeScript types and interfaces scoped to permissions.
// Field shapes mirror the Permission/PermissionGroup Prisma models. Distinct from config/permissions.config.ts
// (the frontend's local ACL string registry, used by usePermission/<Can>) - this module is about
// fetching the authoritative permission catalog and role-permission matrix from the backend once
// it exists, e.g. for a Roles & Permissions admin screen.

export interface PermissionGroup {
  id: string
  name: string
  description: string | null
  module: string
  displayOrder: number
}

export interface Permission {
  id: string
  code: string
  name: string
  description: string | null
  module: string
  action: string
  resource: string
  isSensitive: boolean
  groupId: string | null
}

export interface PermissionMatrixEntry {
  roleId: string
  permissionId: string
  granted: boolean
}

export interface UpdatePermissionMatrixPayload {
  roleId: string
  permissionId: string
  granted: boolean
}
