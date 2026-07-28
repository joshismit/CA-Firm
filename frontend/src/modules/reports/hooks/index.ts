// reports-scoped React hooks - data-fetching wrappers (TanStack Query) and local UI state.

import { useMutation, useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/services/query-keys'
import { exportReport, generateReport } from '../api'
import type { ReportExportFormat, ReportFilters, ReportType } from '../types'

export function useReportQuery(type: ReportType, filters: ReportFilters) {
  return useQuery({ queryKey: queryKeys.reports.report(type, filters), queryFn: () => generateReport(type, filters) })
}

export function useExportReportMutation() {
  return useMutation({
    mutationFn: ({ type, filters, format }: { type: ReportType; filters: ReportFilters; format: ReportExportFormat }) =>
      exportReport(type, filters, format),
  })
}
