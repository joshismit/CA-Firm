// TypeScript types and interfaces scoped to documents.
// Field shapes matched (field-for-field) against backend/src/modules/documents/dto/document.res.dto.ts
// once the Documents Prisma model and backend module were designed and shipped.

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

/** Metadata-only update - matches backend's updateDocumentSchema (no file replacement). */
export interface UpdateDocumentPayload {
  businessId?: string | null
  contactId?: string | null
  category?: DocumentCategory
}

export interface DocumentDownloadUrl {
  url: string
  expiresInSeconds: number
}
