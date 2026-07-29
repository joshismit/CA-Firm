// billing-scoped React hooks - data-fetching wrappers (TanStack Query) and local UI state.

import { useMutation, useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/services/query-keys'
import { createCheckoutSession, getSubscription, listInvoices, listPlans } from '../api'
import type { CreateCheckoutSessionPayload, InvoiceListFilters } from '../types'

// retry: false - a 501 NOT_IMPLEMENTED will never succeed on retry (same convention as
// modules/compliance, modules/client-billing, modules/notifications, modules/reports, modules/audit,
// modules/settings). Added here since Settings > Billing now depends on these hooks directly.
export function useSubscriptionQuery() {
  return useQuery({ queryKey: queryKeys.billing.subscription, queryFn: getSubscription, retry: false })
}

export function usePlansQuery() {
  return useQuery({ queryKey: queryKeys.billing.plans, queryFn: listPlans, retry: false })
}

export function useInvoicesQuery(filters: InvoiceListFilters) {
  return useQuery({ queryKey: queryKeys.billing.invoices(filters), queryFn: () => listInvoices(filters), retry: false })
}

export function useCreateCheckoutSessionMutation() {
  return useMutation({
    mutationFn: (payload: CreateCheckoutSessionPayload) => createCheckoutSession(payload),
  })
}
