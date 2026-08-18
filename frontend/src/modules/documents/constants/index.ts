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

// PRD §7.5 — must mirror backend/src/shared/constants/file-types.constants.ts's
// SUPPORTED_DOCUMENT_TYPES exactly. This is UX only (an upfront friendly rejection before the
// network round trip) - the backend remains the source of truth and re-validates extension, MIME
// type, and file content regardless of what passes here.
export const SUPPORTED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

export const SUPPORTED_FILE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png']

/** Friendly, human-readable summary of supported types - shown in upload hints and error copy. */
export const SUPPORTED_FILE_TYPES_HINT = 'JPG, JPEG, PNG, or PDF'

/** For the native `<input accept>` attribute - extensions catch OS file pickers that filter by name, MIME types catch those that filter by declared type. */
export const SUPPORTED_FILE_TYPES_ACCEPT = [
  ...SUPPORTED_FILE_EXTENSIONS.map((ext) => `.${ext}`),
  ...SUPPORTED_MIME_TYPES,
].join(',')

function getFileExtension(fileName: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(fileName)
  return match ? match[1].toLowerCase() : ''
}

/** Upfront client-side check (extension + MIME) mirroring the backend's rule, for a friendly pre-upload rejection. */
export function isSupportedDocumentFile(file: File): boolean {
  const extension = getFileExtension(file.name)
  return SUPPORTED_FILE_EXTENSIONS.includes(extension) && SUPPORTED_MIME_TYPES.includes(file.type)
}
