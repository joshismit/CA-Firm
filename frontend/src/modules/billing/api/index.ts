// billing API request functions, built on the shared Axios instance from src/services/axios.ts.
//
// NOT YET AVAILABLE: there is no Subscription/Invoice/Payment Prisma model or backend module yet
// (Tenant only carries planCode/subscriptionStatus fields). Every function below is a typed
// placeholder - wire the real apiClient call (and Razorpay handoff) once the backend implements
// this module. No mock data, no guessed endpoint path.

import type { ApiError } from '@/services/api-error'
import type { PaginatedResponse } from '@/types/api.types'
import type {
  CheckoutSession,
  CreateCheckoutSessionPayload,
  Invoice,
  InvoiceListFilters,
  Subscription,
  SubscriptionPlan,
} from '../types'

function notImplemented(action: string): never {
  throw {
    status: 501,
    code: 'NOT_IMPLEMENTED',
    message: `Billing API is not available yet (${action}).`,
  } satisfies ApiError
}

// TODO: GET /api/v1/billing/subscription
export async function getSubscription(): Promise<Subscription> {
  return notImplemented('getSubscription')
}

// TODO: GET /api/v1/billing/plans
export async function listPlans(): Promise<SubscriptionPlan[]> {
  return notImplemented('listPlans')
}

// TODO: GET /api/v1/billing/invoices
export async function listInvoices(_filters: InvoiceListFilters): Promise<PaginatedResponse<Invoice>> {
  return notImplemented('listInvoices')
}

// TODO: POST /api/v1/billing/checkout-session (Razorpay order creation)
export async function createCheckoutSession(_payload: CreateCheckoutSessionPayload): Promise<CheckoutSession> {
  return notImplemented('createCheckoutSession')
}
