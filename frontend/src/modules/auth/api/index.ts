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

function base64url(input: object): string {
  return btoa(JSON.stringify(input)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function buildFakeJwt(user: LoginResponseUser): string {
  const header = { alg: 'none', typ: 'JWT' }
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    permissions: user.permissions,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 15 * 60,
  }
  return `${base64url(header)}.${base64url(payload)}.stub-signature`
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
    accessToken: buildFakeJwt(user),
    user,
    tenant: FIXTURE_TENANT,
  }
}
