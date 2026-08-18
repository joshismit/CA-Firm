// Multi-tenant / white-label type definitions (Tenant, TenantBranding, TenantPlan).

export interface Tenant {
  id: string
  slug: string
  name: string
  planCode: string | null
  isActive: boolean
}

export interface TenantBranding {
  firmName?: string
  logoUrl?: string
  primaryColor?: string
  accentColor?: string
}
