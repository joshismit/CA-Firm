// TypeScript types and interfaces scoped to master-admin.
// Field-for-field match with backend/src/modules/master-admin/dto/master-admin.res.dto.ts -
// the platform-admin backend module is real and mounted (backend/src/modules/master-admin).

export type TenantStatus = 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'DEACTIVATED'

export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED'

/** A tenant row as returned by GET /master-admin/tenants. */
export interface Tenant {
  id: string
  slug: string
  name: string
  status: TenantStatus
  subscriptionStatus: SubscriptionStatus
  planCode: string | null
  userCount: number
  createdAt: string
}

/** Platform-wide resource consumption for one tenant - the "usage view" from PRD §4.1. */
export interface TenantUsage {
  userCount: number
  businessCount: number
  clientCount: number
  documentCount: number
  storageUsedBytes: number
}

export interface TenantDetail extends Omit<Tenant, 'userCount'> {
  subscriptionExpiresAt: string | null
  maxUsers: number | null
  maxClients: number | null
  maxStorageGb: number | null
  maxDocuments: number | null
  usage: TenantUsage
  updatedAt: string
}

export interface TenantListFilters {
  page?: number
  limit?: number
  search?: string
  status?: TenantStatus
}

export interface UpdateTenantStatusPayload {
  status: TenantStatus
}

export interface UpdateTenantLimitsPayload {
  planCode?: string | null
  subscriptionStatus?: SubscriptionStatus
  subscriptionExpiresAt?: string | null
  maxUsers?: number | null
  maxClients?: number | null
  maxStorageGb?: number | null
  maxDocuments?: number | null
}

/** POST /master-admin/tenants - creates the tenant and emails its owner a bootstrap invitation
 * (same accept flow as a staff invite). `slug` is auto-derived from `name` server-side when omitted. */
export interface CreateTenantPayload {
  name: string
  slug?: string
  country?: string
  timezone?: string
  locale?: string
  defaultCurrency?: string
  planCode?: string
  ownerFirstName: string
  ownerLastName: string
  ownerEmail: string
}

// ─── Master admin auth ─────────────────────────────────────────────────────────

export interface MasterAdminLoginRequest {
  email: string
  password: string
}

export interface MasterAdminProfile {
  id: string
  email: string
  firstName: string
  lastName: string
}

export interface MasterAdminLoginResponse {
  accessToken: string
  admin: MasterAdminProfile
}

// Plan catalog types (`AdminPlan` etc.) live in @/modules/billing/types - that module owns `Plan`
// end-to-end (see backend/src/modules/billing/index.ts's header comment).
