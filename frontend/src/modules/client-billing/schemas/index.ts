// Zod schemas for the client-billing forms - client-side validation only. There is no backend
// schema to mirror yet (see types/index.ts's header comment), so these are deliberately
// generic/provisional field rules, not a confirmed server-side contract.
import { z } from 'zod'

export const invoiceStatusValues = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'VOID'] as const
export const expenseStatusValues = ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAID'] as const
export const paymentStatusValues = ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'] as const

export const createInvoiceSchema = z.object({
  invoiceNumber: z.string().trim().min(2, 'Invoice number must be at least 2 characters').max(50),
  clientId: z.string().uuid().optional(),
  businessId: z.string().uuid().optional(),
  amount: z.coerce.number().min(0, 'Amount cannot be negative'),
  tax: z.coerce.number().min(0, 'Tax cannot be negative').optional(),
  dueDate: z.coerce.date().optional(),
  notes: z.string().trim().max(2000).optional(),
})

export const createExpenseSchema = z.object({
  expenseNumber: z.string().trim().min(2, 'Expense number must be at least 2 characters').max(50),
  category: z.string().trim().min(1, 'Select a category'),
  vendor: z.string().trim().max(255).optional(),
  amount: z.coerce.number().min(0, 'Amount cannot be negative'),
  date: z.coerce.date().optional(),
  paymentMethod: z.string().trim().optional(),
  notes: z.string().trim().max(2000).optional(),
})

export const createPaymentSchema = z.object({
  paymentNumber: z.string().trim().min(2, 'Payment number must be at least 2 characters').max(50),
  invoiceId: z.string().uuid().optional(),
  amount: z.coerce.number().min(0, 'Amount cannot be negative'),
  method: z.string().trim().optional(),
  reference: z.string().trim().max(100).optional(),
  paidDate: z.coerce.date().optional(),
  notes: z.string().trim().max(2000).optional(),
})

export const updateInvoiceSchema = createInvoiceSchema.partial()
export const updateExpenseSchema = createExpenseSchema.partial()
export const updatePaymentSchema = createPaymentSchema.partial()

export type CreateInvoiceFormValues = z.infer<typeof createInvoiceSchema>
export type CreateExpenseFormValues = z.infer<typeof createExpenseSchema>
export type CreatePaymentFormValues = z.infer<typeof createPaymentSchema>
