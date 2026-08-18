// src/modules/client-billing/components/ExpenseStatusBadge.tsx
// Thin, module-scoped config layer over the shared StatusBadge - never a new badge implementation.
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { EXPENSE_STATUS_LABELS } from '../constants'
import type { ExpenseStatus } from '../types'

const STATUS_VARIANT: Record<ExpenseStatus, 'default' | 'success' | 'warning' | 'info' | 'danger'> = {
  DRAFT: 'default',
  PENDING: 'warning',
  APPROVED: 'info',
  REJECTED: 'danger',
  PAID: 'success',
}

export interface ExpenseStatusBadgeProps {
  status: ExpenseStatus
  className?: string
}

export function ExpenseStatusBadge({ status, className }: ExpenseStatusBadgeProps) {
  return (
    <StatusBadge variant={STATUS_VARIANT[status]} dot className={className}>
      {EXPENSE_STATUS_LABELS[status] ?? status}
    </StatusBadge>
  )
}
