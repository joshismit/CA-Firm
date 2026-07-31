/**
 * Response DTOs — deliberately omit internal-only fields (`passwordHash`,
 * `failedLoginCount`, `lockedUntil`) that have no value outside the server.
 *
 * `AuthUserDto`/`AuthTenantDto` field-for-field match the frontend's already-
 * built `LoginResponseUser`/`Tenant` types (frontend/src/modules/auth/types,
 * frontend/src/types/tenant.types.ts) — `refreshToken` is a new field neither
 * type has yet (the frontend's current interceptor has no refresh flow to
 * hand it to); that gap closes when the frontend is wired to this module.
 */

export interface AuthUserDto {
  id: string;
  email: string;
  /** Coarse tier for structural gating (e.g. the Master Admin portal) — see AuthService's role-resolution comment. */
  role: string;
  tenantId: string;
  permissions: string[];
  firstName: string;
  lastName: string;
}

export interface AuthTenantDto {
  id: string;
  slug: string;
  name: string;
  planCode: string | null;
  isActive: boolean;
}

export interface LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  user: AuthUserDto;
  tenant: AuthTenantDto;
}

export interface RefreshResponseDto {
  accessToken: string;
  refreshToken: string;
}

/** GET /auth/me — the authenticated user's own full profile (beyond the JWT's minimal claims). */
export interface MeResponseDto extends AuthUserDto {
  status: string;
  isOwner: boolean;
  phone: string | null;
  jobTitle: string | null;
  bio: string | null;
  avatarStorageKey: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

/**
 * GET /auth/invite/:token — matches the frontend's `InviteInfo` exactly
 * (`{ email, tenantName, inviterName, role }` — see
 * frontend/src/modules/auth/types/index.ts). `role` is a single display
 * string even though an invitation can carry multiple `roleIds` — real role
 * names joined with ", ", never fabricated.
 */
export interface InviteInfoResponseDto {
  email: string;
  tenantName: string;
  inviterName: string;
  role: string;
}

export interface SessionResponseDto {
  id: string;
  deviceType: string;
  deviceName: string | null;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
  /** Null unless a geoIP service is configured — never fabricated. */
  locationCity: string | null;
  locationCountry: string | null;
  isCurrent: boolean;
  lastActiveAt: string;
  createdAt: string;
}
