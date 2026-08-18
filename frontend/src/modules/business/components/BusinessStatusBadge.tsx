// src/modules/business/components/BusinessStatusBadge.tsx
// Thin, module-scoped config layer over the shared StatusBadge - never a new badge implementation.
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { BUSINESS_STATUS_LABELS } from '../constants'
import type { BusinessStatus } from '../types'

const STATUS_VARIANT: Record<BusinessStatus, 'default' | 'success' | 'warning' | 'danger'> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
  DORMANT: 'warning',
  STRUCK_OFF: 'danger',
  DISSOLVED: 'danger',
}

export interface BusinessStatusBadgeProps {
  status: BusinessStatus
  className?: string
}

export function BusinessStatusBadge({ status, className }: BusinessStatusBadgeProps) {
  return (
    <StatusBadge variant={STATUS_VARIANT[status]} dot className={className}>
      {BUSINESS_STATUS_LABELS[status] ?? status}
    </StatusBadge>
  )
}
