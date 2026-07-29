// TypeScript types and interfaces scoped to auth.

import type { Tenant } from '@/types/tenant.types'

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponseUser {
  id: string
  email: string
  role: string
  tenantId: string
  permissions: string[]
  firstName?: string
  lastName?: string
}

export interface LoginResponse {
  accessToken: string
  user: LoginResponseUser
  tenant: Tenant
}

// GET /auth/me, POST /auth/change-password, and the /auth/sessions* routes are real, mounted
// backend endpoints (backend/src/modules/auth/routes/auth.routes.ts) - unlike loginRequest() in
// ../api/index.ts (still a client-side dev fixture until a real POST /auth/login is wired up),
// these genuinely hit the backend. Field shapes match backend/src/modules/auth/dto/auth.res.dto.ts
// exactly (MeResponseDto/SessionResponseDto).

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
