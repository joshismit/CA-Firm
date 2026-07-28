// TypeScript types and interfaces scoped to audit.
// PROVISIONAL: the backend only has LoginHistory (auth events only) - there is no generic
// AuditLog Prisma model yet covering uploads/downloads/shares/role changes/etc as the PRD
// describes (section 14.1). This type follows that PRD description.

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
  eventType?: AuditEventType
  actorId?: string
  from?: string
  to?: string
}
