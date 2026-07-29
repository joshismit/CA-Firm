// reports-scoped React hooks - data-fetching wrappers (TanStack Query) and local UI state.

import { useMutation, useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/services/query-keys'
import { exportReport, generateReport } from '../api'
import type { ReportExportFormat, ReportFilters, ReportType } from '../types'

// `enabled` defaults to true only for backward compatibility with any existing caller - the
// report-generation page passes `enabled: hasGenerated` so nothing is attempted until the user
// clicks "Generate", not on page load. retry:false: a 501 NOT_IMPLEMENTED will never succeed on
// retry (same convention as modules/compliance and modules/client-billing).
export function useReportQuery(type: ReportType, filters: ReportFilters, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.reports.report(type, filters),
    queryFn: () => generateReport(type, filters),
    enabled: options?.enabled ?? true,
    retry: false,
  })
}

export function useExportReportMutation() {
  return useMutation({
    mutationFn: ({ type, filters, format }: { type: ReportType; filters: ReportFilters; format: ReportExportFormat }) =>
      exportReport(type, filters, format),
  })
}
