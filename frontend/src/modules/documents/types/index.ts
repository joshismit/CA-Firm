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
  folderId: string | null
  category: DocumentCategory
  /** Original filename shown for download - never the storage key (see PRD 7.3: internal storage uses unique IDs). */
  fileName: string
  storageKey: string
  mimeType: string
  sizeBytes: number
  /** This row's own position in its version chain (1 for the first upload, 2+ for each confirmed replacement). */
  version: number
  /** True only for the newest row in the chain - the one every other view of the document resolves to. */
  isLatestVersion: boolean
  /** Null on the first (v1) version, which is the root; every later version points at it. */
  rootDocumentId: string | null
  /** The version this one replaced, if any - null on v1. */
  previousVersionId: string | null
  uploadedById: string
  createdAt: string
}

/**
 * PRD §7.2 rule 6 - the `details` payload of the 409 a duplicate upload throws
 * (same Business + Contact + Folder + Category + filename as an existing document,
 * uploaded without `createVersion: true`). See `services/api-error.ts`'s `ApiError.details`.
 */
export interface DocumentConflict {
  message: string
  currentVersion: DocumentFile
  nextVersion: number
}

export interface DocumentListFilters {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  search?: string
  category?: DocumentCategory
  businessId?: string
  folderId?: string
  /** Bounds on the upload date (createdAt) - matches backend's `uploadedFrom`/`uploadedTo`. */
  uploadedFrom?: string
  uploadedTo?: string
}

export interface UploadDocumentPayload {
  businessId?: string
  contactId?: string
  folderId?: string
  category: DocumentCategory
  file: File
  /** PRD §7.2 rule 7 - confirms a replace after a prior attempt 409'd with a `DocumentConflict`. */
  createVersion?: boolean
}

/** Metadata-only update - matches backend's updateDocumentSchema (no file replacement). */
export interface UpdateDocumentPayload {
  businessId?: string | null
  contactId?: string | null
  folderId?: string | null
  category?: DocumentCategory
}

// ─── Folders (PRD §7.1 rule 3 - Business → category → Folder → Subfolder → Documents) ─────────

export interface DocumentFolder {
  id: string
  businessId: string
  category: DocumentCategory
  parentFolderId: string | null
  name: string
  createdById: string
  createdAt: string
  updatedAt: string
}

export interface DocumentFolderListFilters {
  category?: DocumentCategory
  parentFolderId?: string
}

export interface CreateFolderPayload {
  category: DocumentCategory
  parentFolderId?: string
  name: string
}

/** Rename only - category/business/parent are immutable after creation (matches backend). */
export interface UpdateFolderPayload {
  name: string
}

export interface DocumentDownloadUrl {
  url: string
  expiresInSeconds: number
}

/**
 * Reusable document template (e.g. an engagement-letter or NOC boilerplate a firm fills in per
 * client) - PROVISIONAL: no backend Prisma model or routes exist for this yet, distinct from the
 * real, backend-backed `DocumentFile` above. See api/index.ts's `notImplemented()` block.
 */
export interface DocumentTemplate {
  id: string
  name: string
  description: string | null
  category: DocumentCategory
  updatedAt: string
}

export interface DocumentTemplateListFilters {
  page?: number
  limit?: number
  search?: string
  category?: DocumentCategory
}
