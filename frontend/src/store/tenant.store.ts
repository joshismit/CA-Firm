// Active tenant/firm context for multi-tenant switching (current firm id, branding, white-label config).
// Populated at login time from the login response's tenant field, re-seeded each session.

import { create } from 'zustand'
import type { Tenant, TenantBranding } from '@/types/tenant.types'

interface TenantState {
  tenant: Tenant | null
  branding: TenantBranding | null
  setTenant: (tenant: Tenant | null) => void
  setBranding: (branding: TenantBranding | null) => void
}

export const useTenantStore = create<TenantState>((set) => ({
  tenant: null,
  branding: null,
  setTenant: (tenant) => set({ tenant }),
  setBranding: (branding) => set({ branding }),
}))
