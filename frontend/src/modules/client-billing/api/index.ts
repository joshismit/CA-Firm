// client-billing API request functions, built on the shared Axios instance from src/services/axios.ts.
//
// NOT YET AVAILABLE: no backend module exists for Invoices/Expenses/Payments-to-clients (see
// types/index.ts's header comment). Every function below is a typed placeholder that throws a real
// 501 NOT_IMPLEMENTED ApiError - mirrors the exact pattern already established in modules/billing,
// modules/reports, modules/notifications, and modules/audit. No mock data, no guessed endpoint path
// beyond the plausible, provisional `/billing/{invoices|expenses|payments}` base that already
// matches this app's sidebar route naming - not a confirmed contract. Never returns a fabricated
// empty/successful response.
import type { ApiError } from '@/services/api-error'
import type { PaginatedResponse } from '@/types/api.types'
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

function notImplemented(resource: string, action: string): never {
  throw {
    status: 501,
    code: 'NOT_IMPLEMENTED',
    message: `${resource} API is not available yet (${action}).`,
  } satisfies ApiError
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

// TODO: GET /billing/invoices
export async function listInvoices(_filters: InvoiceListFilters): Promise<PaginatedResponse<Invoice>> {
  return notImplemented('Invoices', 'listInvoices')
}

// TODO: GET /billing/invoices/:id
export async function getInvoice(_id: string): Promise<Invoice> {
  return notImplemented('Invoices', 'getInvoice')
}

// TODO: POST /billing/invoices
export async function createInvoice(_payload: CreateInvoicePayload): Promise<Invoice> {
  return notImplemented('Invoices', 'createInvoice')
}

// TODO: PATCH /billing/invoices/:id
export async function updateInvoice(_id: string, _payload: UpdateInvoicePayload): Promise<Invoice> {
  return notImplemented('Invoices', 'updateInvoice')
}

// TODO: DELETE /billing/invoices/:id
export async function deleteInvoice(_id: string): Promise<void> {
  return notImplemented('Invoices', 'deleteInvoice')
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

// TODO: GET /billing/expenses
export async function listExpenses(_filters: ExpenseListFilters): Promise<PaginatedResponse<Expense>> {
  return notImplemented('Expenses', 'listExpenses')
}

// TODO: GET /billing/expenses/:id
export async function getExpense(_id: string): Promise<Expense> {
  return notImplemented('Expenses', 'getExpense')
}

// TODO: POST /billing/expenses
export async function createExpense(_payload: CreateExpensePayload): Promise<Expense> {
  return notImplemented('Expenses', 'createExpense')
}

// TODO: PATCH /billing/expenses/:id
export async function updateExpense(_id: string, _payload: UpdateExpensePayload): Promise<Expense> {
  return notImplemented('Expenses', 'updateExpense')
}

// TODO: DELETE /billing/expenses/:id
export async function deleteExpense(_id: string): Promise<void> {
  return notImplemented('Expenses', 'deleteExpense')
}

// ─── Payments ─────────────────────────────────────────────────────────────────

// TODO: GET /billing/payments
export async function listPayments(_filters: PaymentListFilters): Promise<PaginatedResponse<Payment>> {
  return notImplemented('Payments', 'listPayments')
}

// TODO: GET /billing/payments/:id
export async function getPayment(_id: string): Promise<Payment> {
  return notImplemented('Payments', 'getPayment')
}

// TODO: POST /billing/payments
export async function createPayment(_payload: CreatePaymentPayload): Promise<Payment> {
  return notImplemented('Payments', 'createPayment')
}

// TODO: PATCH /billing/payments/:id
export async function updatePayment(_id: string, _payload: UpdatePaymentPayload): Promise<Payment> {
  return notImplemented('Payments', 'updatePayment')
}

// TODO: DELETE /billing/payments/:id
export async function deletePayment(_id: string): Promise<void> {
  return notImplemented('Payments', 'deletePayment')
}
