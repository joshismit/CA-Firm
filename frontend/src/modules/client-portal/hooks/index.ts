// client-portal-scoped React hooks - data-fetching wrappers (TanStack Query).
// `retry: false` on every query - the underlying API is a guaranteed 501 today (see api/index.ts).

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/services/query-keys'
import { getPortalSummary, listSharedDocuments } from '../api'
import type { SharedDocumentListFilters } from '../types'

export function usePortalSummaryQuery() {
  return useQuery({
    queryKey: queryKeys.clientPortal.summary,
    queryFn: () => getPortalSummary(),
    retry: false,
  })
}

export function useSharedDocumentsQuery(filters: SharedDocumentListFilters) {
  return useQuery({
    queryKey: queryKeys.clientPortal.documentsList(filters),
    queryFn: () => listSharedDocuments(filters),
    retry: false,
  })
}
