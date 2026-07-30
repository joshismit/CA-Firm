import { Role } from '@prisma/client';
import { RoleResponseDto } from '../dto/role.res.dto';

/** A `Role` row with its `RolePermission -> Permission.code` join resolved — what `RoleRepository`'s include-widened queries actually return. */
export type RoleWithPermissions = Role & { rolePermissions: Array<{ permission: { code: string } }> };

/**
 * Entity ⇄ DTO mapper for `Role`. Controllers/services must always return
 * data through this mapper — never serialize a raw Prisma row in a response.
 */
export class RoleMapper {
  static toResponseDto(role: RoleWithPermissions): RoleResponseDto {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      color: role.color,
      type: role.type,
      isActive: role.isActive,
      permissionCodes: role.rolePermissions.map((rp) => rp.permission.code),
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
    };
  }

  static toResponseDtoList(roles: RoleWithPermissions[]): RoleResponseDto[] {
    return roles.map((role) => this.toResponseDto(role));
  }
}
