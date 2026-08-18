// src/modules/compliance/components/ComplianceStatusBadge.tsx
// Thin, module-scoped config layer over the shared StatusBadge - never a new badge implementation.
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { COMPLIANCE_STATUS_LABELS } from '../constants'
import type { ComplianceFilingStatus } from '../types'

const STATUS_VARIANT: Record<ComplianceFilingStatus, 'default' | 'success' | 'warning' | 'danger'> = {
  DRAFT: 'default',
  PENDING: 'warning',
  FILED: 'success',
  OVERDUE: 'danger',
}

export interface ComplianceStatusBadgeProps {
  status: ComplianceFilingStatus
  className?: string
}

export function ComplianceStatusBadge({ status, className }: ComplianceStatusBadgeProps) {
  return (
    <StatusBadge variant={STATUS_VARIANT[status]} dot className={className}>
      {COMPLIANCE_STATUS_LABELS[status] ?? status}
    </StatusBadge>
  )
}
