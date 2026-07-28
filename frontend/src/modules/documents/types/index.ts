// TypeScript types and interfaces scoped to documents.
// PROVISIONAL: unlike Business/Contacts/CRM, there is no Prisma model for documents at all yet
// (confirmed against backend/prisma/schema.prisma) - these shapes are inferred from the PRD's
// document-vault description (categories, versioning, secure storage naming) and will need
// revisiting once the backend actually designs this module.

export type DocumentCategory =
  | 'PAN'
  | 'GST'
  | 'INCOME_TAX'
  | 'ROC'
  | 'AUDIT'
  | 'BANK'
  | 'AGREEMENTS'
  | 'PAYROLL'
  | 'DSC'
  | 'IDENTITY'
  | 'OTHER'

export interface DocumentFile {
  id: string
  businessId: string | null
  contactId: string | null
  category: DocumentCategory
  /** Original filename shown for download - never the storage key (see PRD 7.3: internal storage uses unique IDs). */
  fileName: string
  storageKey: string
  mimeType: string
  sizeBytes: number
  version: number
  uploadedById: string
  createdAt: string
}

export interface DocumentListFilters {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  search?: string
  category?: DocumentCategory
  businessId?: string
}

export interface UploadDocumentPayload {
  businessId?: string
  contactId?: string
  category: DocumentCategory
  file: File
}
