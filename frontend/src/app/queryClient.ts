// Single shared TanStack QueryClient instance, configured from config/query.config.ts.

import { QueryClient } from '@tanstack/react-query'
import { queryConfig } from '@/config/query.config'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: queryConfig,
    mutations: { retry: 0 },
  },
})
