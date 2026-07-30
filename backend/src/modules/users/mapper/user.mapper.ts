import { User, UserInvitation, Role } from '@prisma/client';
import { UserResponseDto, UserInvitationResponseDto, UserRoleResponseDto } from '../dto/user.res.dto';

/** A `Role` row as returned by `UserRepository.findRolesForUser()` — includes the join to resolve `permissionCodes`. */
export type RoleWithPermissions = Role & { rolePermissions: Array<{ permission: { code: string } }> };

/**
 * Entity ⇄ DTO mapper for `User`/`UserInvitation`/`Role`. Controllers/services
 * must always return data through this mapper — never serialize a raw Prisma
 * row in a response.
 */
export class UserMapper {
  static toResponseDto(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      status: user.status,
      isOwner: user.isOwner,
      avatarStorageKey: user.avatarStorageKey,
      jobTitle: user.jobTitle,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
    };
  }

  static toResponseDtoList(users: User[]): UserResponseDto[] {
    return users.map((user) => this.toResponseDto(user));
  }

  static toInvitationResponseDto(invitation: UserInvitation): UserInvitationResponseDto {
    return {
      id: invitation.id,
      email: invitation.email,
      firstName: invitation.firstName,
      lastName: invitation.lastName,
      status: invitation.status,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
    };
  }

  static toInvitationResponseDtoList(invitations: UserInvitation[]): UserInvitationResponseDto[] {
    return invitations.map((invitation) => this.toInvitationResponseDto(invitation));
  }

  static toRoleResponseDto(role: RoleWithPermissions): UserRoleResponseDto {
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

  static toRoleResponseDtoList(roles: RoleWithPermissions[]): UserRoleResponseDto[] {
    return roles.map((role) => this.toRoleResponseDto(role));
  }
}
