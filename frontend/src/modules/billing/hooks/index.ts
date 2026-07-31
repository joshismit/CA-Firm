// billing-scoped React hooks - data-fetching wrappers (TanStack Query) and local UI state.
// Real endpoints (backend/src/modules/billing, mounted at /subscription) - not NOT_IMPLEMENTED stubs.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/query-keys'
import {
  createCheckoutSession,
  createPlan,
  getSubscription,
  listAdminPlans,
  listInvoices,
  listPlans,
  updatePlan,
  verifyCheckoutPayment,
} from '../api'
import { openRazorpayCheckout } from '../utils'
import type { CreatePlanPayload, InvoiceListFilters, Subscription, UpdatePlanPayload } from '../types'

export function useSubscriptionQuery() {
  return useQuery({ queryKey: queryKeys.billing.subscription, queryFn: getSubscription })
}

export function usePlansQuery() {
  return useQuery({ queryKey: queryKeys.billing.plans, queryFn: listPlans })
}

export function useInvoicesQuery(filters: InvoiceListFilters) {
  return useQuery({ queryKey: queryKeys.billing.invoices(filters), queryFn: () => listInvoices(filters) })
}

/**
 * The full checkout flow in one mutation: creates a Razorpay order, opens the
 * hosted Checkout.js modal, and verifies the payment once the customer
 * completes it. Resolves with the tenant's updated `Subscription`, or
 * rejects if the customer dismisses the modal or verification fails -
 * either way `BillingSettingsPage` reads `checkoutMutation.error` for a
 * message the same way as any other mutation.
 */
export function useSubscribeToPlanMutation() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (planCode: string) =>
      createCheckoutSession({ planCode }).then(
        (session) =>
          new Promise<Subscription>((resolve, reject) => {
            openRazorpayCheckout(
              session,
              (verifyPayload) => {
                verifyCheckoutPayment(verifyPayload).then(resolve).catch(reject)
              },
              () => reject(new Error('Checkout was cancelled.')),
            ).catch(reject)
          }),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.billing.subscription })
      qc.invalidateQueries({ queryKey: queryKeys.billing.plans })
      qc.invalidateQueries({ queryKey: ['billing', 'invoices'] })
    },
  })
}

// ─── Master-admin plan management ───────────────────────────────────────────────

export function useAdminPlansQuery() {
  return useQuery({ queryKey: queryKeys.masterAdmin.plans, queryFn: listAdminPlans })
}

export function useCreatePlanMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreatePlanPayload) => createPlan(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.masterAdmin.plans }),
  })
}

export function useUpdatePlanMutation(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdatePlanPayload) => updatePlan(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.masterAdmin.plans }),
  })
}
