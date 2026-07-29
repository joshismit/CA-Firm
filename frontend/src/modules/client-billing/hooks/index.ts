// client-billing-scoped React hooks - data-fetching wrappers (TanStack Query) for Invoices,
// Expenses, and Payments. Every query/mutation genuinely calls the real (currently-stubbed) API
// functions, so isError/error reflect a real 501 rejection, not a fabricated empty result - same
// convention as modules/billing, modules/compliance, modules/reports, etc. `retry: false` on every
// query: a 501 NOT_IMPLEMENTED will never succeed on retry, so there's no reason to pay React
// Query's default 3-retry backoff before the honest error shows.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/query-keys'
import {
  createExpense,
  createInvoice,
  createPayment,
  deleteExpense,
  deleteInvoice,
  deletePayment,
  getExpense,
  getInvoice,
  getPayment,
  listExpenses,
  listInvoices,
  listPayments,
  updateExpense,
  updateInvoice,
  updatePayment,
} from '../api'
import type {
  CreateExpensePayload,
  CreateInvoicePayload,
  CreatePaymentPayload,
  ExpenseListFilters,
  InvoiceListFilters,
  PaymentListFilters,
  UpdateExpensePayload,
  UpdateInvoicePayload,
  UpdatePaymentPayload,
} from '../types'

// ─── Invoices ─────────────────────────────────────────────────────────────────

export function useInvoicesQuery(filters: InvoiceListFilters) {
  return useQuery({ queryKey: queryKeys.clientInvoices.list(filters), queryFn: () => listInvoices(filters), retry: false })
}

export function useInvoiceQuery(id: string) {
  return useQuery({ queryKey: queryKeys.clientInvoices.detail(id), queryFn: () => getInvoice(id), enabled: !!id, retry: false })
}

export function useCreateInvoiceMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateInvoicePayload) => createInvoice(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.clientInvoices.lists() }),
  })
}

export function useUpdateInvoiceMutation(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateInvoicePayload) => updateInvoice(id, payload),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.clientInvoices.detail(id), updated)
      qc.invalidateQueries({ queryKey: queryKeys.clientInvoices.lists() })
    },
  })
}

export function useDeleteInvoiceMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteInvoice(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.clientInvoices.lists() }),
  })
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

export function useExpensesQuery(filters: ExpenseListFilters) {
  return useQuery({ queryKey: queryKeys.clientExpenses.list(filters), queryFn: () => listExpenses(filters), retry: false })
}

export function useExpenseQuery(id: string) {
  return useQuery({ queryKey: queryKeys.clientExpenses.detail(id), queryFn: () => getExpense(id), enabled: !!id, retry: false })
}

export function useCreateExpenseMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateExpensePayload) => createExpense(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.clientExpenses.lists() }),
  })
}

export function useUpdateExpenseMutation(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateExpensePayload) => updateExpense(id, payload),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.clientExpenses.detail(id), updated)
      qc.invalidateQueries({ queryKey: queryKeys.clientExpenses.lists() })
    },
  })
}

export function useDeleteExpenseMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.clientExpenses.lists() }),
  })
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export function usePaymentsQuery(filters: PaymentListFilters) {
  return useQuery({ queryKey: queryKeys.clientPayments.list(filters), queryFn: () => listPayments(filters), retry: false })
}

export function usePaymentQuery(id: string) {
  return useQuery({ queryKey: queryKeys.clientPayments.detail(id), queryFn: () => getPayment(id), enabled: !!id, retry: false })
}

export function useCreatePaymentMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreatePaymentPayload) => createPayment(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.clientPayments.lists() }),
  })
}

export function useUpdatePaymentMutation(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdatePaymentPayload) => updatePayment(id, payload),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.clientPayments.detail(id), updated)
      qc.invalidateQueries({ queryKey: queryKeys.clientPayments.lists() })
    },
  })
}

export function useDeletePaymentMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePayment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.clientPayments.lists() }),
  })
}
