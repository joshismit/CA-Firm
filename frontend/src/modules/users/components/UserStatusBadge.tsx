// src/modules/users/components/UserStatusBadge.tsx
// Thin, module-scoped config layer over the shared StatusBadge - never a new badge implementation.
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { USER_STATUS_LABELS } from '../constants'
import type { UserStatus } from '../types'

const STATUS_VARIANT: Record<UserStatus, 'default' | 'success' | 'warning' | 'info' | 'danger'> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
  INVITED: 'info',
  SUSPENDED: 'warning',
  DELETED: 'danger',
}

export interface UserStatusBadgeProps {
  status: UserStatus
  className?: string
}

export function UserStatusBadge({ status, className }: UserStatusBadgeProps) {
  return (
    <StatusBadge variant={STATUS_VARIANT[status]} dot className={className}>
      {USER_STATUS_LABELS[status] ?? status}
    </StatusBadge>
  )
}
