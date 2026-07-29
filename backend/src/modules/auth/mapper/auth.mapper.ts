import { User, UserSession } from '@prisma/client';
import { AuthUserDto, MeResponseDto, SessionResponseDto } from '../dto/auth.res.dto';

/**
 * Entity ⇄ DTO mapper for Auth's read-facing shapes. Controllers/services must always return data
 * through this mapper — never serialize a raw Prisma row in a response.
 */
export class AuthMapper {
  static toAuthUserDto(user: User, role: string, permissions: string[]): AuthUserDto {
    return {
      id: user.id,
      email: user.email,
      role,
      tenantId: user.tenantId,
      permissions,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }

  static toMeResponseDto(user: User, role: string, permissions: string[]): MeResponseDto {
    return {
      ...this.toAuthUserDto(user, role, permissions),
      status: user.status,
      isOwner: user.isOwner,
      phone: user.phone,
      jobTitle: user.jobTitle,
      bio: user.bio,
      avatarStorageKey: user.avatarStorageKey,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
    };
  }

  static toSessionResponseDto(session: UserSession, currentSessionId: string | undefined): SessionResponseDto {
    return {
      id: session.id,
      deviceType: session.deviceType,
      deviceName: session.deviceName,
      browser: session.browser,
      os: session.os,
      ipAddress: session.ipAddress,
      locationCity: session.locationCity,
      locationCountry: session.locationCountry,
      isCurrent: session.id === currentSessionId,
      lastActiveAt: session.lastActiveAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
    };
  }

  static toSessionResponseDtoList(sessions: UserSession[], currentSessionId: string | undefined): SessionResponseDto[] {
    return sessions.map((session) => this.toSessionResponseDto(session, currentSessionId));
  }
}
