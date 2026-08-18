// src/modules/audit/components/AuditEventBadge.tsx
// Thin, module-scoped config layer over the shared StatusBadge - never a new badge implementation.
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { AUDIT_EVENT_LABELS } from '../constants'
import type { AuditEventType } from '../types'

const EVENT_VARIANT: Record<AuditEventType, 'default' | 'success' | 'warning' | 'info' | 'danger'> = {
  UPLOAD: 'info',
  DOWNLOAD: 'info',
  SHARE: 'info',
  SHARE_REVOKED: 'warning',
  DOCUMENT_DELETE: 'danger',
  LOGIN: 'success',
  LOGOUT: 'default',
  FAILED_LOGIN: 'danger',
  SESSION_REVOKED: 'warning',
  ROLE_CHANGE: 'warning',
  PERMISSION_CHANGE: 'warning',
  TASK_UPDATE: 'default',
  PAYMENT_ACTION: 'success',
  PASSWORD_RESET: 'warning',
  INVITATION_ACCEPTED: 'success',
  TASK_REMINDER_SENT: 'info',
  SETTINGS_UPDATE: 'warning',
  UPLOAD_REJECTED: 'danger',
  INVOICE_CREATED: 'success',
  INVOICE_UPDATED: 'default',
  INVOICE_DELETED: 'danger',
  PAYMENT_COMPLETED: 'success',
  SUBSCRIPTION_UPDATED: 'info',
  FOLDER_CREATED: 'success',
  FOLDER_RENAMED: 'default',
  FOLDER_DELETED: 'danger',
  DASHBOARD_PREFERENCES_CHANGED: 'default',
  DASHBOARD_LAYOUT_RESET: 'warning',
  DASHBOARD_DEFAULTS_UPDATED: 'warning',
  NOTIFICATION_TEMPLATE_CREATED: 'success',
  NOTIFICATION_TEMPLATE_UPDATED: 'default',
  NOTIFICATION_TEMPLATE_DELETED: 'danger',
  DOCUMENT_APPROVED: 'success',
  DOCUMENT_REJECTED: 'danger',
}

export interface AuditEventBadgeProps {
  eventType: AuditEventType
  className?: string
}

export function AuditEventBadge({ eventType, className }: AuditEventBadgeProps) {
  return (
    <StatusBadge variant={EVENT_VARIANT[eventType]} dot className={className}>
      {AUDIT_EVENT_LABELS[eventType] ?? eventType}
    </StatusBadge>
  )
}
