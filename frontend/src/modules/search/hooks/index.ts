// search-scoped React hooks - data-fetching wrappers (TanStack Query).

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/services/query-keys'
import { globalSearch } from '../api'

export function useGlobalSearchQuery(q: string, limit = 10) {
  return useQuery({
    queryKey: queryKeys.search.results(q, limit),
    queryFn: () => globalSearch(q, limit),
    enabled: q.trim().length > 0,
  })
}
