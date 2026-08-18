// src/modules/client-billing/components/PaymentStatusBadge.tsx
// Thin, module-scoped config layer over the shared StatusBadge - never a new badge implementation.
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { PAYMENT_STATUS_LABELS } from '../constants'
import type { PaymentStatus } from '../types'

const STATUS_VARIANT: Record<PaymentStatus, 'default' | 'success' | 'warning' | 'info' | 'danger'> = {
  PENDING: 'warning',
  COMPLETED: 'success',
  FAILED: 'danger',
  REFUNDED: 'info',
}

export interface PaymentStatusBadgeProps {
  status: PaymentStatus
  className?: string
}

export function PaymentStatusBadge({ status, className }: PaymentStatusBadgeProps) {
  return (
    <StatusBadge variant={STATUS_VARIANT[status]} dot className={className}>
      {PAYMENT_STATUS_LABELS[status] ?? status}
    </StatusBadge>
  )
}
