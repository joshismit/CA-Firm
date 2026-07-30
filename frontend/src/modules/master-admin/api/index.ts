// master-admin API request functions, built on the shared Axios instance from src/services/axios.ts.
//
// NOT YET AVAILABLE: no platform-level tenant-management/subscription backend module exists (this
// app only has tenant-scoped routes today - see backend/src/app.ts). Every function below is a
// typed placeholder - wire the real apiClient call once a platform-admin backend module exists. No
// mock data, no guessed endpoint path beyond the plausible `/master-admin/...` base already implied
// by this app's own route naming (/master-admin/tenants, /master-admin/subscriptions).

import type { ApiError } from '@/services/api-error'
import type { PaginatedResponse } from '@/types/api.types'
import type { SubscriptionPlan, Tenant, TenantListFilters } from '../types'

function notImplemented(action: string): never {
  throw {
    status: 501,
    code: 'NOT_IMPLEMENTED',
    message: `Master Admin API is not available yet (${action}).`,
  } satisfies ApiError
}

// TODO: GET /master-admin/tenants
export async function listTenants(_filters: TenantListFilters): Promise<PaginatedResponse<Tenant>> {
  return notImplemented('listTenants')
}

// TODO: GET /master-admin/subscriptions/plans
export async function listSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  return notImplemented('listSubscriptionPlans')
}
