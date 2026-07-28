// TypeScript types and interfaces scoped to reports.
// PROVISIONAL: reports are computed/aggregated views, not a Prisma model - the report type list
// matches PRD section 13.2 exactly.

export type ReportType =
  | 'NEW_LEADS'
  | 'CONVERTED_CLIENTS'
  | 'PENDING_TASKS'
  | 'PENDING_DOCUMENTS'
  | 'PAYMENTS_PENDING'
  | 'DOCUMENT_ACTIVITY'
  | 'STAFF_ASSIGNMENT_SUMMARY'
  | 'MONTHLY_PENDING_WORK'

export interface ReportFilters {
  from?: string
  to?: string
  staffId?: string
}

export interface ReportResult<TRow = Record<string, unknown>> {
  type: ReportType
  generatedAt: string
  rows: TRow[]
}

export type ReportExportFormat = 'CSV' | 'PDF' | 'XLSX'
