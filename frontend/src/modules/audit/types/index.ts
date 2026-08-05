// TypeScript types and interfaces scoped to audit.
// Field-for-field match with the backend's AuditLogResponseDto
// (backend/src/modules/audit/dto/audit.res.dto.ts), which itself follows the PRD's
// section 14.1 tracked-event list.

export type AuditEventType =
  | 'UPLOAD'
  | 'DOWNLOAD'
  | 'SHARE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'ROLE_CHANGE'
  | 'TASK_UPDATE'
  | 'PAYMENT_ACTION'
  | 'PERMISSION_CHANGE'
  | 'PASSWORD_RESET'
  | 'INVITATION_ACCEPTED'
  | 'TASK_REMINDER_SENT'
  | 'SETTINGS_UPDATE'
  | 'UPLOAD_REJECTED'

export interface AuditLogEntry {
  id: string
  eventType: AuditEventType
  actorId: string
  actorName: string
  targetType: string | null
  targetId: string | null
  description: string
  ipAddress: string | null
  createdAt: string
}

export interface AuditLogFilters {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  search?: string
  eventType?: AuditEventType
  actorId?: string
  targetType?: string
  from?: string
  to?: string
}
