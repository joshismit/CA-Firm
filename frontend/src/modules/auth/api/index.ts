// auth API request functions, built on the shared Axios instance from src/services/axios.ts.
//
// loginRequest() below is still a client-side dev fixture (not a real network call) - it stands
// in for POST /auth/login, which the frontend isn't wired to yet even though the backend now
// implements it (backend/src/modules/auth/routes/auth.routes.ts). getMe/changePassword/
// listSessions/revokeSession below are NOT stand-ins, though - those backend routes are real and
// mounted, so they call apiClient directly like every other real module's API layer.
//
// SWAP PLAN for login: once the frontend is wired to a real refresh-token flow, replace
// loginRequest()'s body with:
//   const { data } = await apiClient.post<ApiResponse<LoginResponse>>('/auth/login', credentials)
//   return data.data
// The signature and return type stay identical - no caller needs to change.

import type { ApiError } from '@/services/api-error'
import { apiClient } from '@/services/axios'
import type { ApiResponse } from '@/types/api.types'
import { PERMISSIONS } from '@/config/permissions.config'
import { env } from '@/config/env'
import type { AuthMeResponse, AuthSession, ChangePasswordPayload, LoginRequest, LoginResponse, LoginResponseUser } from '../types'

const FIXTURE_TENANT = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'demo-firm',
  name: 'Demo & Associates, Chartered Accountants',
  planCode: 'GROWTH',
  isActive: true,
}

const FIXTURE_PASSWORD = 'Password123!'

const FIXTURE_USERS: Record<string, LoginResponseUser> = {
  'ca@demo.firm': {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'ca@demo.firm',
    role: 'TENANT_ADMIN',
    tenantId: FIXTURE_TENANT.id,
    firstName: 'Aditi',
    lastName: 'Kapoor',
    permissions: Object.values(PERMISSIONS),
  },
  'staff@demo.firm': {
    id: '33333333-3333-4333-8333-333333333333',
    email: 'staff@demo.firm',
    role: 'STAFF',
    tenantId: FIXTURE_TENANT.id,
    firstName: 'Rohan',
    lastName: 'Mehta',
    permissions: [
      PERMISSIONS.PROJECTS_READ,
      PERMISSIONS.TASKS_READ,
      PERMISSIONS.TASKS_UPDATE,
      PERMISSIONS.CLIENTS_READ,
      PERMISSIONS.CONTACTS_READ,
      PERMISSIONS.BUSINESS_READ,
      PERMISSIONS.CRM_READ,
      PERMISSIONS.DOCUMENTS_READ,
    ],
  },
}

function base64urlFromString(input: object): string {
  return btoa(JSON.stringify(input)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlFromBytes(bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function signHs256(signingInput: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(signingInput))
  return base64urlFromBytes(signature)
}

async function buildJwt(user: LoginResponseUser): Promise<string> {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    permissions: user.permissions,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 15 * 60,
  }

  // If VITE_DEV_JWT_SECRET is set (see .env.development.local), sign a real HS256 token matching
  // the backend's JWT_ACCESS_SECRET - this lets Projects/Tasks (the only modules with a real API)
  // be exercised against a genuinely running backend before a real /auth/login exists. The fixture
  // ids above match rows already seeded in the local dev DB (tenant "demo-firm" + these two users)
  // so authMiddleware's signature check AND tenantMiddleware's DB lookup both succeed.
  // Local dev only - this must never run with a real secret in a deployed build.
  if (env.devJwtSecret) {
    const header = { alg: 'HS256', typ: 'JWT' }
    const signingInput = `${base64urlFromString(header)}.${base64urlFromString(payload)}`
    const signature = await signHs256(signingInput, env.devJwtSecret)
    return `${signingInput}.${signature}`
  }

  const header = { alg: 'none', typ: 'JWT' }
  return `${base64urlFromString(header)}.${base64urlFromString(payload)}.stub-signature`
}

const delay = (ms = 600) => new Promise((resolve) => setTimeout(resolve, ms))

export async function loginRequest(credentials: LoginRequest): Promise<LoginResponse> {
  await delay()

  const user = FIXTURE_USERS[credentials.email.trim().toLowerCase()]
  if (!user || credentials.password !== FIXTURE_PASSWORD) {
    throw {
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password.',
    } satisfies ApiError
  }

  return {
    accessToken: await buildJwt(user),
    user,
    tenant: FIXTURE_TENANT,
  }
}

// ─── Real endpoints (backend/src/modules/auth/routes/auth.routes.ts) ──────────

export async function getMe(): Promise<AuthMeResponse> {
  const { data } = await apiClient.get<ApiResponse<AuthMeResponse>>('/auth/me')
  return data.data
}

export async function changePassword(payload: ChangePasswordPayload): Promise<void> {
  await apiClient.post('/auth/change-password', payload)
}

export async function listSessions(): Promise<AuthSession[]> {
  const { data } = await apiClient.get<ApiResponse<AuthSession[]>>('/auth/sessions')
  return data.data
}

export async function revokeSession(id: string): Promise<void> {
  await apiClient.delete(`/auth/sessions/${id}`)
}
