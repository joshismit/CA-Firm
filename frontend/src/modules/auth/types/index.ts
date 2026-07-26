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
