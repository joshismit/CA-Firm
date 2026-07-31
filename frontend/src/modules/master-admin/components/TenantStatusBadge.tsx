// src/modules/master-admin/components/TenantStatusBadge.tsx
// Thin, module-scoped config layer over the shared StatusBadge - never a new badge implementation.
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { TENANT_STATUS_LABELS } from '../constants'
import type { TenantStatus } from '../types'

const STATUS_VARIANT: Record<TenantStatus, 'default' | 'success' | 'warning' | 'danger'> = {
  ACTIVE: 'success',
  TRIAL: 'default',
  SUSPENDED: 'warning',
  DEACTIVATED: 'danger',
}

export interface TenantStatusBadgeProps {
  status: TenantStatus
  className?: string
}

export function TenantStatusBadge({ status, className }: TenantStatusBadgeProps) {
  return (
    <StatusBadge variant={STATUS_VARIANT[status]} dot className={className}>
      {TENANT_STATUS_LABELS[status] ?? status}
    </StatusBadge>
  )
}
