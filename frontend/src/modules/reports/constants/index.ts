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
  NEW_LEADS: 'Leads created within a date range, groupable by source or owner.',
  CONVERTED_CLIENTS: 'Leads that converted to clients within a date range, with a conversion ratio.',
  PENDING_TASKS: 'Open tasks across all projects, groupable by staff, priority, status, or due date.',
  PENDING_DOCUMENTS: 'Document requests still awaiting upload, with overdue tracking, groupable by business or staff.',
  PAYMENTS_PENDING: 'Outstanding payments and invoices, with overdue tracking, groupable by business or staff.',
  DOCUMENT_ACTIVITY: 'Uploads, downloads, versions, and shares across the document vault, groupable by business, staff, or date.',
  STAFF_ASSIGNMENT_SUMMARY: 'Assigned clients, leads, and tasks — plus pending/completed work — per staff member.',
  MONTHLY_PENDING_WORK: 'Monthly rollup of pending tasks, invoices, filings, and document requests across the firm.',
}

/** PRD §13.2 — which `groupBy` values each report type's filters form should offer. Omitted entirely for types with no grouping concept (Converted Clients, Staff Assignment Summary, Monthly Pending Work — all already one row per group by definition). */
export const REPORT_TYPE_GROUP_BY_OPTIONS: Partial<Record<string, Array<{ value: string; label: string }>>> = {
  NEW_LEADS: [
    { value: 'SOURCE', label: 'Source' },
    { value: 'OWNER', label: 'Owner' },
  ],
  PENDING_TASKS: [
    { value: 'STAFF', label: 'Staff' },
    { value: 'PRIORITY', label: 'Priority' },
    { value: 'STATUS', label: 'Status' },
    { value: 'DUE_DATE', label: 'Due date' },
  ],
  PENDING_DOCUMENTS: [
    { value: 'BUSINESS', label: 'Business' },
    { value: 'STAFF', label: 'Staff' },
  ],
  PAYMENTS_PENDING: [
    { value: 'BUSINESS', label: 'Business' },
    { value: 'STAFF', label: 'Staff' },
  ],
  DOCUMENT_ACTIVITY: [
    { value: 'BUSINESS', label: 'Business' },
    { value: 'STAFF', label: 'Staff' },
    { value: 'DATE', label: 'Date' },
  ],
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
