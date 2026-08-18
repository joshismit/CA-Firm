// TypeScript types and interfaces scoped to reports.
// Reports are computed/aggregated views, not a Prisma model - field shapes mirror
// backend/src/modules/reports/dto/report.res.dto.ts exactly. PENDING_DOCUMENTS and PDF/XLSX export
// return a real 501 (no document review/signature status or PDF/XLSX generation library exists
// yet) - every other report type and CSV export are real.

export type ReportType =
  | 'NEW_LEADS'
  | 'CONVERTED_CLIENTS'
  | 'PENDING_TASKS'
  | 'PENDING_DOCUMENTS'
  | 'PAYMENTS_PENDING'
  | 'DOCUMENT_ACTIVITY'
  | 'STAFF_ASSIGNMENT_SUMMARY'
  | 'MONTHLY_PENDING_WORK'

// PRD §13.2 — the full union of `groupBy` values any report type supports. Each report type only
// honors the subset relevant to it (see `REPORT_TYPE_GROUP_BY_OPTIONS` in ../constants); an
// unsupported value is silently ignored by the backend, never a 422.
export type ReportGroupBy = 'SOURCE' | 'OWNER' | 'STAFF' | 'PRIORITY' | 'STATUS' | 'DUE_DATE' | 'BUSINESS' | 'DATE'

export interface ReportFilters {
  from?: string
  to?: string
  staffId?: string
  groupBy?: ReportGroupBy
}

export interface ReportResult<TRow = Record<string, unknown>> {
  type: ReportType
  generatedAt: string
  rows: TRow[]
  /** PRD §13.2 report #2 (Converted Clients) only — a scalar aggregate ("conversion ratio") that doesn't fit as a row. */
  meta?: Record<string, unknown>
}

export type ReportExportFormat = 'CSV' | 'PDF' | 'XLSX'
