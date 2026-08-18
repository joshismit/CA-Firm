import { RoleType } from '@prisma/client';

/**
 * Response DTO — field-for-field match with the frontend's already-built
 * `Role` type (frontend/src/modules/roles/types/index.ts). `permissionCodes`
 * is resolved from `RolePermission` → `Permission.code`, never a raw
 * `RolePermission`/`Permission` row.
 */
export interface RoleResponseDto {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  type: RoleType;
  isActive: boolean;
  permissionCodes: string[];
  createdAt: string;
  updatedAt: string;
}
