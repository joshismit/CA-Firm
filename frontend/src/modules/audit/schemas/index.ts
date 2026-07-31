// Zod schemas for audit forms and API payload/response validation.
// Audit log entries are system-generated, not user-created - the only form here is the filter bar.

import { z } from 'zod'

export const auditEventTypeValues = [
  'UPLOAD',
  'DOWNLOAD',
  'SHARE',
  'LOGIN',
  'LOGOUT',
  'ROLE_CHANGE',
  'TASK_UPDATE',
  'PAYMENT_ACTION',
  'PERMISSION_CHANGE',
  'PASSWORD_RESET',
  'INVITATION_ACCEPTED',
] as const

export const auditLogFiltersSchema = z.object({
  eventType: z.enum(auditEventTypeValues).optional(),
  actorId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

export type AuditLogFiltersFormValues = z.infer<typeof auditLogFiltersSchema>
