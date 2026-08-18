// client-billing-scoped constants (status labels, option lists). All generic/provisional per
// types/index.ts's header comment - no backend module exists to confirm these against yet.

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  VOID: 'Void',
}

export const EXPENSE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  PAID: 'Paid',
}

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
}

/** Generic placeholder categories - not backed by any real taxonomy yet. */
export const EXPENSE_CATEGORY_OPTIONS = [
  { value: 'OFFICE_SUPPLIES', label: 'Office Supplies' },
  { value: 'SOFTWARE', label: 'Software & Subscriptions' },
  { value: 'TRAVEL', label: 'Travel' },
  { value: 'UTILITIES', label: 'Utilities' },
  { value: 'PROFESSIONAL_FEES', label: 'Professional Fees' },
  { value: 'RENT', label: 'Rent' },
  { value: 'OTHER', label: 'Other' },
] as const

/** Generic placeholder methods - not backed by any real payment-gateway integration yet. */
export const PAYMENT_METHOD_OPTIONS = [
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'OTHER', label: 'Other' },
] as const
