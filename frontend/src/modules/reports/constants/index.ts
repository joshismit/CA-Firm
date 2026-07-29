// reports-scoped constants (enums, option lists, default values).
// Matches PRD section 13.2's report list exactly.

export const REPORT_TYPE_LABELS: Record<string, string> = {
  NEW_LEADS: 'New Leads',
  CONVERTED_CLIENTS: 'Converted Clients',
  PENDING_TASKS: 'Pending Tasks',
  PENDING_DOCUMENTS: 'Pending Documents',
  PAYMENTS_PENDING: 'Payments Pending',
  DOCUMENT_ACTIVITY: 'Document Activity',
  STAFF_ASSIGNMENT_SUMMARY: 'Staff Assignment Summary',
  MONTHLY_PENDING_WORK: 'Monthly Pending Work Summary',
}

export const REPORT_TYPE_OPTIONS = Object.entries(REPORT_TYPE_LABELS).map(([value, label]) => ({ value, label }))

export const REPORT_TYPE_DESCRIPTIONS: Record<string, string> = {
  NEW_LEADS: 'Leads created within a date range, grouped by source and stage.',
  CONVERTED_CLIENTS: 'Leads that converted to clients within a date range.',
  PENDING_TASKS: 'Open tasks across all projects, optionally filtered by assignee.',
  PENDING_DOCUMENTS: 'Documents awaiting review or signature.',
  PAYMENTS_PENDING: 'Outstanding client payments as of a given date.',
  DOCUMENT_ACTIVITY: 'Uploads, downloads, and shares across the document vault.',
  STAFF_ASSIGNMENT_SUMMARY: 'Workload distribution across staff members.',
  MONTHLY_PENDING_WORK: 'Monthly rollup of everything still outstanding across the firm.',
}

/**
 * Category grouping is a display-only convenience for browsing the 8 report types above - it is
 * not a separate backend concept. "Financial"/"Client"/"Operational" here map onto the existing,
 * already-established ReportType enum; there is deliberately no "GST"/"Revenue" category, since no
 * report type in that enum is backed by GST or revenue data (Compliance and Billing have no
 * backend either - see their own modules' header comments), and inventing one here would just be a
 * different flavor of the same fabrication this module already avoids elsewhere.
 */
export const REPORT_CATEGORY_LABELS = {
  CLIENT: 'Client Reports',
  FINANCIAL: 'Financial Reports',
  OPERATIONAL: 'Operational Reports',
} as const

export const REPORT_TYPE_CATEGORY: Record<string, keyof typeof REPORT_CATEGORY_LABELS> = {
  NEW_LEADS: 'CLIENT',
  CONVERTED_CLIENTS: 'CLIENT',
  PAYMENTS_PENDING: 'FINANCIAL',
  PENDING_TASKS: 'OPERATIONAL',
  PENDING_DOCUMENTS: 'OPERATIONAL',
  DOCUMENT_ACTIVITY: 'OPERATIONAL',
  STAFF_ASSIGNMENT_SUMMARY: 'OPERATIONAL',
  MONTHLY_PENDING_WORK: 'OPERATIONAL',
}
