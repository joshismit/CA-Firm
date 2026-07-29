// audit-scoped React hooks - data-fetching wrappers (TanStack Query) and local UI state.

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/services/query-keys'
import { getAuditLogEntry, listAuditLogs } from '../api'
import type { AuditLogFilters } from '../types'

// retry: false - a 501 NOT_IMPLEMENTED will never succeed on retry (same convention as
// modules/compliance, modules/client-billing, modules/notifications, modules/reports).
export function useAuditLogsQuery(filters: AuditLogFilters) {
  return useQuery({ queryKey: queryKeys.audit.list(filters), queryFn: () => listAuditLogs(filters), retry: false })
}

export function useAuditLogEntryQuery(id: string) {
  return useQuery({ queryKey: queryKeys.audit.detail(id), queryFn: () => getAuditLogEntry(id), enabled: !!id, retry: false })
}
