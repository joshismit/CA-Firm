// auth API request functions, built on the shared Axios instance from src/services/axios.ts.
//
// The backend has no /auth/login endpoint yet (backend/src/modules/auth is an empty stub), so
// loginRequest() below is a stand-in that resolves fixture data shaped exactly like the real
// response will be, against the JWT payload backend/src/middlewares/auth.middleware.ts already
// expects: { sub, email, role, tenantId, permissions, iat, exp }.
//
// SWAP PLAN: once the backend ships POST /auth/login, replace this function's body with:
//   const { data } = await apiClient.post<ApiResponse<LoginResponse>>('/auth/login', credentials)
//   return data.data
// The signature and return type stay identical - no caller needs to change.

import type { ApiError } from '@/services/api-error'
import { PERMISSIONS } from '@/config/permissions.config'
import { env } from '@/config/env'
import type { LoginRequest, LoginResponse, LoginResponseUser } from '../types'

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
