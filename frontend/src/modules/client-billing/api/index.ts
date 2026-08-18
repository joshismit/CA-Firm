// client-billing API request functions, built on the shared Axios instance from src/services/axios.ts.
// Hits the real backend at ${env.apiBaseUrl}/billing/{invoices|expenses|payments}
// (backend/src/modules/client-billing/routes/*.routes.ts) - mirrors modules/compliance/api/index.ts
// now that the Client Billing backend module exists. The `/billing/{invoices|expenses|payments}`
// base this file already called before the backend existed turned out to be the real, confirmed
// contract (not a guess that needed changing).
import { apiClient } from '@/services/axios'
import type { ApiResponse, PaginatedResponse } from '@/types/api.types'
import type {
  CreateExpensePayload,
  CreateInvoicePayload,
  CreatePaymentPayload,
  Expense,
  ExpenseListFilters,
  Invoice,
  InvoiceListFilters,
  Payment,
  PaymentListFilters,
  UpdateExpensePayload,
  UpdateInvoicePayload,
  UpdatePaymentPayload,
} from '../types'

// ─── Invoices ─────────────────────────────────────────────────────────────────

export async function listInvoices(filters: InvoiceListFilters): Promise<PaginatedResponse<Invoice>> {
  const { data } = await apiClient.get<PaginatedResponse<Invoice>>('/billing/invoices', { params: filters })
  return data
}

export async function getInvoice(id: string): Promise<Invoice> {
  const { data } = await apiClient.get<ApiResponse<Invoice>>(`/billing/invoices/${id}`)
  return data.data
}

export async function createInvoice(payload: CreateInvoicePayload): Promise<Invoice> {
  const { data } = await apiClient.post<ApiResponse<Invoice>>('/billing/invoices', payload)
  return data.data
}

export async function updateInvoice(id: string, payload: UpdateInvoicePayload): Promise<Invoice> {
  const { data } = await apiClient.patch<ApiResponse<Invoice>>(`/billing/invoices/${id}`, payload)
  return data.data
}

export async function deleteInvoice(id: string): Promise<void> {
  await apiClient.delete(`/billing/invoices/${id}`)
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

export async function listExpenses(filters: ExpenseListFilters): Promise<PaginatedResponse<Expense>> {
  const { data } = await apiClient.get<PaginatedResponse<Expense>>('/billing/expenses', { params: filters })
  return data
}

export async function getExpense(id: string): Promise<Expense> {
  const { data } = await apiClient.get<ApiResponse<Expense>>(`/billing/expenses/${id}`)
  return data.data
}

export async function createExpense(payload: CreateExpensePayload): Promise<Expense> {
  const { data } = await apiClient.post<ApiResponse<Expense>>('/billing/expenses', payload)
  return data.data
}

export async function updateExpense(id: string, payload: UpdateExpensePayload): Promise<Expense> {
  const { data } = await apiClient.patch<ApiResponse<Expense>>(`/billing/expenses/${id}`, payload)
  return data.data
}

export async function deleteExpense(id: string): Promise<void> {
  await apiClient.delete(`/billing/expenses/${id}`)
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export async function listPayments(filters: PaymentListFilters): Promise<PaginatedResponse<Payment>> {
  const { data } = await apiClient.get<PaginatedResponse<Payment>>('/billing/payments', { params: filters })
  return data
}

export async function getPayment(id: string): Promise<Payment> {
  const { data } = await apiClient.get<ApiResponse<Payment>>(`/billing/payments/${id}`)
  return data.data
}

export async function createPayment(payload: CreatePaymentPayload): Promise<Payment> {
  const { data } = await apiClient.post<ApiResponse<Payment>>('/billing/payments', payload)
  return data.data
}

export async function updatePayment(id: string, payload: UpdatePaymentPayload): Promise<Payment> {
  const { data } = await apiClient.patch<ApiResponse<Payment>>(`/billing/payments/${id}`, payload)
  return data.data
}

export async function deletePayment(id: string): Promise<void> {
  await apiClient.delete(`/billing/payments/${id}`)
}
