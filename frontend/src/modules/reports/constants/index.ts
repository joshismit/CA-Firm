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
