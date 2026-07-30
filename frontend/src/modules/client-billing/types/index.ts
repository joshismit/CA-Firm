// TypeScript types for the firm's client-facing billing (Invoices, Expenses, Payments the firm
// issues to / incurs for its own clients).
//
// NOT the same domain as modules/billing/ (that module is the tenant's own SaaS subscription
// billing to the ERP vendor - Subscription/SubscriptionPlan/CheckoutSession/Razorpay - a
// completely different concern that already owns the word "billing" as a module name and the
// `billing:*` permission resource). This module is named `client-billing` specifically to avoid
// colliding with that pre-existing, unrelated module - do not merge the two. Gated on the separate
// `PERMISSIONS.CLIENT_BILLING_READ`/`MANAGE` pair (config/permissions.config.ts).
//
// Field shapes mirror backend/src/modules/client-billing/dto/*.res.dto.ts exactly. `status` is
// stored server-side but not yet settable via create/update (no form in this module collects one,
// so there is no status-transition endpoint). `clientId`/`businessId`/`invoiceId` are plain UUID
// references only, matching this module's raw-UUID-input forms - no lookup API, no nested objects.

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'VOID'
export type ExpenseStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID'
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED'

/** Provisional shape - no backend Invoice model exists yet. Fields per product direction: Invoice Number, Client, Business, Amount, Tax, Due Date, Status. */
export interface Invoice {
  id: string
  invoiceNumber: string
  clientId: string | null
  businessId: string | null
  amount: number
  tax: number
  issuedDate: string | null
  dueDate: string | null
  status: InvoiceStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface InvoiceListFilters {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  search?: string
  status?: InvoiceStatus
}

export interface CreateInvoicePayload {
  invoiceNumber: string
  clientId?: string
  businessId?: string
  amount: number
  tax?: number
  dueDate?: string
  notes?: string
}

export type UpdateInvoicePayload = Partial<CreateInvoicePayload>

/** Provisional shape - no backend Expense model exists yet. Fields per product direction: Expense Number, Category, Vendor, Amount, Date, Payment Method, Status. */
export interface Expense {
  id: string
  expenseNumber: string
  category: string
  vendor: string | null
  amount: number
  date: string | null
  paymentMethod: string | null
  status: ExpenseStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface ExpenseListFilters {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  search?: string
  status?: ExpenseStatus
  category?: string
}

export interface CreateExpensePayload {
  expenseNumber: string
  category: string
  vendor?: string
  amount: number
  date?: string
  paymentMethod?: string
  notes?: string
}

export type UpdateExpensePayload = Partial<CreateExpensePayload>

/** Provisional shape - no backend Payment model exists yet. Fields per product direction: Payment Number, Invoice, Amount, Method, Reference, Paid Date, Status. */
export interface Payment {
  id: string
  paymentNumber: string
  invoiceId: string | null
  amount: number
  method: string | null
  reference: string | null
  paidDate: string | null
  status: PaymentStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface PaymentListFilters {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  search?: string
  status?: PaymentStatus
}

export interface CreatePaymentPayload {
  paymentNumber: string
  invoiceId?: string
  amount: number
  method?: string
  reference?: string
  paidDate?: string
  notes?: string
}

export type UpdatePaymentPayload = Partial<CreatePaymentPayload>
