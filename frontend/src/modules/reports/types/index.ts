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
