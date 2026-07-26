// Default TanStack Query client options (staleTime, gcTime, retry, refetchOnWindowFocus) consumed by app/queryClient.ts.

export const queryConfig = {
  staleTime: 30_000,
  gcTime: 5 * 60_000,
  retry: 1,
  refetchOnWindowFocus: false,
} as const
