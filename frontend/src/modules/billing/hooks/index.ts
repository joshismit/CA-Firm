// billing-scoped React hooks - data-fetching wrappers (TanStack Query) and local UI state.

import { useMutation, useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/services/query-keys'
import { createCheckoutSession, getSubscription, listInvoices, listPlans } from '../api'
import type { CreateCheckoutSessionPayload, InvoiceListFilters } from '../types'

export function useSubscriptionQuery() {
  return useQuery({ queryKey: queryKeys.billing.subscription, queryFn: getSubscription })
}

export function usePlansQuery() {
  return useQuery({ queryKey: queryKeys.billing.plans, queryFn: listPlans })
}

export function useInvoicesQuery(filters: InvoiceListFilters) {
  return useQuery({ queryKey: queryKeys.billing.invoices(filters), queryFn: () => listInvoices(filters) })
}

export function useCreateCheckoutSessionMutation() {
  return useMutation({
    mutationFn: (payload: CreateCheckoutSessionPayload) => createCheckoutSession(payload),
  })
}
