// TypeScript types and interfaces scoped to auth.

import type { Tenant } from '@/types/tenant.types'

export interface LoginRequest {
  email: string
  password: string
  /** Extends the refresh-token/session horizon to 30 days server-side instead of the default 7. */
  rememberMe?: boolean
}

export interface LoginResponseUser {
  id: string
  email: string
  role: string
  tenantId: string
  permissions: string[]
  firstName: string
  lastName: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: LoginResponseUser
  tenant: Tenant
}

export interface RefreshTokenRequest {
  refreshToken: string
}

export interface RefreshTokenResponse {
  accessToken: string
  refreshToken: string
}

export interface LogoutRequest {
  refreshToken: string
}

// Every endpoint below is real and mounted (backend/src/modules/auth/routes/auth.routes.ts).
// Field shapes match backend/src/modules/auth/dto/auth.res.dto.ts exactly (LoginResponseDto/
// RefreshResponseDto/MeResponseDto/SessionResponseDto).

/** The authenticated user's own full profile - GET /auth/me. There is no PATCH /auth/me yet, so
 * this is read-only until an update-profile endpoint exists. */
export interface AuthMeResponse {
  id: string
  email: string
  role: string
  tenantId: string
  permissions: string[]
  firstName: string
  lastName: string
  status: string
  isOwner: boolean
  phone: string | null
  jobTitle: string | null
  bio: string | null
  avatarStorageKey: string | null
  lastLoginAt: string | null
  createdAt: string
}

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
}

export interface AuthSession {
  id: string
  deviceType: string
  deviceName: string | null
  browser: string | null
  os: string | null
  ipAddress: string | null
  /** Null unless a geoIP service is configured server-side - never fabricated here either. */
  locationCity: string | null
  locationCountry: string | null
  isCurrent: boolean
  lastActiveAt: string
  createdAt: string
}

// ─── Provisional (see api/index.ts's notImplemented() block) ──────────────────
// No register/forgot-password/reset-password/invite backend routes exist yet (unlike getMe/
// changePassword/sessions above) - these describe the eventual API contract only.

export interface RegisterRequest {
  fullName: string
  email: string
  password: string
}

export interface ForgotPasswordRequest {
  email: string
}

export interface ResetPasswordRequest {
  token: string
  newPassword: string
}

/** Preview shown before a user accepts an invite - who invited them, and to which firm/role. */
export interface InviteInfo {
  email: string
  tenantName: string
  inviterName: string
  role: string
}

export interface AcceptInviteRequest {
  token: string
  fullName: string
  password: string
}
