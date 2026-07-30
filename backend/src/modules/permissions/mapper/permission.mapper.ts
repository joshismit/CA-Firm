import { Permission, PermissionGroup } from '@prisma/client';
import { PermissionResponseDto, PermissionGroupResponseDto, PermissionMatrixEntryResponseDto } from '../dto/permission.res.dto';

/**
 * Entity ⇄ DTO mapper for `Permission`/`PermissionGroup` and the derived
 * permission-matrix shape. Controllers/services must always return data
 * through this mapper — never serialize a raw Prisma row in a response.
 */
export class PermissionMapper {
  /**
   * `Permission.action` is stored as Prisma's generated `PermissionAction`
   * enum (uppercase: READ/MANAGE/...) because `Permission.action` is a real
   * DB enum column — but the frontend's entire action vocabulary
   * (`config/permissions.config.ts`'s `PERMISSION_ACTIONS`, and every
   * `resource:action` permission `code` suffix) is lowercase, and
   * `PermissionFilters`' action dropdown does exact string equality against
   * this field. Lowercased here so that filter actually matches — a
   * serialization choice, not an invented field.
   */
  static toResponseDto(permission: Permission): PermissionResponseDto {
    return {
      id: permission.id,
      code: permission.code,
      name: permission.name,
      description: permission.description,
      module: permission.module,
      action: permission.action.toLowerCase(),
      resource: permission.resource,
      isSensitive: permission.isSensitive,
      groupId: permission.groupId,
    };
  }

  static toResponseDtoList(permissions: Permission[]): PermissionResponseDto[] {
    return permissions.map((permission) => this.toResponseDto(permission));
  }

  static toGroupResponseDto(group: PermissionGroup): PermissionGroupResponseDto {
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      module: group.module,
      displayOrder: group.displayOrder,
    };
  }

  static toGroupResponseDtoList(groups: PermissionGroup[]): PermissionGroupResponseDto[] {
    return groups.map((group) => this.toGroupResponseDto(group));
  }

  static toMatrixEntryResponseDto(roleId: string, permissionId: string, granted: boolean): PermissionMatrixEntryResponseDto {
    return { roleId, permissionId, granted };
  }
}
