// audit API request functions, built on the shared Axios instance from src/services/axios.ts.
//
// NOT YET AVAILABLE: only LoginHistory exists on the backend (auth events only) - there is no
// generic audit-log module covering uploads/shares/role changes/etc. This is a typed placeholder -
// wire the real apiClient call once the backend implements it. No mock data, no guessed endpoint path.

import type { ApiError } from '@/services/api-error'
import type { PaginatedResponse } from '@/types/api.types'
import type { AuditLogEntry, AuditLogFilters } from '../types'

function notImplemented(action: string): never {
  throw {
    status: 501,
    code: 'NOT_IMPLEMENTED',
    message: `Audit API is not available yet (${action}).`,
  } satisfies ApiError
}

// TODO: GET /api/v1/audit-logs
export async function listAuditLogs(_filters: AuditLogFilters): Promise<PaginatedResponse<AuditLogEntry>> {
  return notImplemented('listAuditLogs')
}
