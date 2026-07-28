// audit-scoped React hooks - data-fetching wrappers (TanStack Query) and local UI state.

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/services/query-keys'
import { listAuditLogs } from '../api'
import type { AuditLogFilters } from '../types'

export function useAuditLogsQuery(filters: AuditLogFilters) {
  return useQuery({ queryKey: queryKeys.audit.list(filters), queryFn: () => listAuditLogs(filters) })
}
