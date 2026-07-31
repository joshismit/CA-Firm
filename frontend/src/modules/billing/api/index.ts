// billing API request functions, built on the shared Axios instance from src/services/axios.ts.
// Hits the real backend at ${env.apiBaseUrl}/subscription (backend/src/modules/billing/routes/
// billing.routes.ts) - mounted at /subscription, not /billing, to avoid colliding with
// modules/client-billing's /billing/invoices|expenses|payments (see that route file's header
// comment). Mirrors modules/business/api/index.ts now that this backend module exists.

import { apiClient } from '@/services/axios'
import type { ApiResponse, PaginatedResponse } from '@/types/api.types'
import type {
  AdminPlan,
  CheckoutSession,
  CreateCheckoutSessionPayload,
  CreatePlanPayload,
  Invoice,
  InvoiceListFilters,
  Subscription,
  SubscriptionPlan,
  UpdatePlanPayload,
  VerifyCheckoutPaymentPayload,
} from '../types'

export async function getSubscription(): Promise<Subscription> {
  const { data } = await apiClient.get<ApiResponse<Subscription>>('/subscription/current')
  return data.data
}

export async function listPlans(): Promise<SubscriptionPlan[]> {
  const { data } = await apiClient.get<ApiResponse<SubscriptionPlan[]>>('/subscription/plans')
  return data.data
}

export async function listInvoices(filters: InvoiceListFilters): Promise<PaginatedResponse<Invoice>> {
  const { data } = await apiClient.get<PaginatedResponse<Invoice>>('/subscription/invoices', { params: filters })
  return data
}

export async function createCheckoutSession(payload: CreateCheckoutSessionPayload): Promise<CheckoutSession> {
  const { data } = await apiClient.post<ApiResponse<CheckoutSession>>('/subscription/checkout', payload)
  return data.data
}

export async function verifyCheckoutPayment(payload: VerifyCheckoutPaymentPayload): Promise<Subscription> {
  const { data } = await apiClient.post<ApiResponse<Subscription>>('/subscription/checkout/verify', payload)
  return data.data
}

// ─── Master-admin plan management (backend/src/modules/master-admin, reusing modules/billing's
// own PlanController) ────────────────────────────────────────────────────────────────────────

export async function listAdminPlans(): Promise<AdminPlan[]> {
  const { data } = await apiClient.get<ApiResponse<AdminPlan[]>>('/master-admin/plans')
  return data.data
}

export async function createPlan(payload: CreatePlanPayload): Promise<AdminPlan> {
  const { data } = await apiClient.post<ApiResponse<AdminPlan>>('/master-admin/plans', payload)
  return data.data
}

export async function updatePlan(id: string, payload: UpdatePlanPayload): Promise<AdminPlan> {
  const { data } = await apiClient.patch<ApiResponse<AdminPlan>>(`/master-admin/plans/${id}`, payload)
  return data.data
}
