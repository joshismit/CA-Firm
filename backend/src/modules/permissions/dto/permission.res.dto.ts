/**
 * Response DTO — field-for-field match with the frontend's already-built
 * `Permission` type (frontend/src/modules/permissions/types/index.ts).
 * `action` is lowercased at the mapper boundary — see `PermissionMapper`'s
 * comment for why.
 */
export interface PermissionResponseDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  module: string;
  action: string;
  resource: string;
  isSensitive: boolean;
  groupId: string | null;
}

/** Field-for-field match with the frontend's `PermissionGroup` type. */
export interface PermissionGroupResponseDto {
  id: string;
  name: string;
  description: string | null;
  module: string;
  displayOrder: number;
}

/** Field-for-field match with the frontend's `PermissionMatrixEntry` type. */
export interface PermissionMatrixEntryResponseDto {
  roleId: string;
  permissionId: string;
  granted: boolean;
}
