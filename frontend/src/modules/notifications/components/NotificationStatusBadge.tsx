// src/modules/notifications/components/NotificationStatusBadge.tsx
// Thin, module-scoped config layer over the shared StatusBadge - never a new badge implementation.
// This is the delivery status (PENDING/SENT/DELIVERED/FAILED), distinct from read/unread - see
// NotificationReadBadge for that.
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { NOTIFICATION_STATUS_LABELS } from '../constants'
import type { NotificationStatus } from '../types'

const STATUS_VARIANT: Record<NotificationStatus, 'default' | 'success' | 'warning' | 'info' | 'danger'> = {
  PENDING: 'warning',
  SENT: 'info',
  DELIVERED: 'success',
  FAILED: 'danger',
}

export interface NotificationStatusBadgeProps {
  status: NotificationStatus
  className?: string
}

export function NotificationStatusBadge({ status, className }: NotificationStatusBadgeProps) {
  return (
    <StatusBadge variant={STATUS_VARIANT[status]} dot className={className}>
      {NOTIFICATION_STATUS_LABELS[status] ?? status}
    </StatusBadge>
  )
}
