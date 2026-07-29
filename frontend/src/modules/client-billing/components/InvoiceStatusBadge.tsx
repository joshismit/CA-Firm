// src/modules/client-billing/components/InvoiceStatusBadge.tsx
// Thin, module-scoped config layer over the shared StatusBadge - never a new badge implementation.
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { INVOICE_STATUS_LABELS } from '../constants'
import type { InvoiceStatus } from '../types'

const STATUS_VARIANT: Record<InvoiceStatus, 'default' | 'success' | 'warning' | 'info' | 'danger'> = {
  DRAFT: 'default',
  SENT: 'info',
  PAID: 'success',
  OVERDUE: 'danger',
  VOID: 'default',
}

export interface InvoiceStatusBadgeProps {
  status: InvoiceStatus
  className?: string
}

export function InvoiceStatusBadge({ status, className }: InvoiceStatusBadgeProps) {
  return (
    <StatusBadge variant={STATUS_VARIANT[status]} dot className={className}>
      {INVOICE_STATUS_LABELS[status] ?? status}
    </StatusBadge>
  )
}
