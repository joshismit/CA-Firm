// TypeScript types and interfaces scoped to master-admin.
// PROVISIONAL: no platform-level Tenant/Subscription backend module exists yet (see
// api/index.ts's header comment) - these describe the eventual API contract only.

export type TenantStatus = 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'CANCELLED'

export interface Tenant {
  id: string
  firmName: string
  planName: string
  status: TenantStatus
  staffCount: number
  createdAt: string
}

export interface TenantListFilters {
  page?: number
  limit?: number
  search?: string
  status?: TenantStatus
}

export interface SubscriptionPlan {
  id: string
  name: string
  priceMonthly: number
  tenantCount: number
}
