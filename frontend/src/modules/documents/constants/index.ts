// documents-scoped constants (enums, option lists, default values).
// Matches PRD section 7 exactly (categories, default max upload size, supported file types) -
// no backend enum exists yet since there's no Documents Prisma model, so this is the source of truth for now.

export const DOCUMENT_CATEGORY_VALUES = [
  'PAN',
  'GST',
  'INCOME_TAX',
  'ROC',
  'AUDIT',
  'BANK',
  'AGREEMENTS',
  'PAYROLL',
  'DSC',
  'IDENTITY',
  'OTHER',
] as const

export const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  PAN: 'PAN',
  GST: 'GST',
  INCOME_TAX: 'Income Tax',
  ROC: 'ROC',
  AUDIT: 'Audit',
  BANK: 'Bank',
  AGREEMENTS: 'Agreements',
  PAYROLL: 'Payroll',
  DSC: 'DSC',
  IDENTITY: 'Identity',
  OTHER: 'Other',
}

export const DOCUMENT_CATEGORY_OPTIONS = DOCUMENT_CATEGORY_VALUES.map((value) => ({
  value,
  label: DOCUMENT_CATEGORY_LABELS[value],
}))

/** Default per-file upload limit (PRD 7.4) - firms can override with exceptions server-side. */
export const MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024

/** Suggested default per-client storage target (PRD 7.4), adjustable by plan. */
export const DEFAULT_CLIENT_STORAGE_TARGET_BYTES = 500 * 1024 * 1024

export const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'application/zip',
  'application/x-zip-compressed',
]
