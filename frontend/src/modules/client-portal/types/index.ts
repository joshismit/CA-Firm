// TypeScript types and interfaces scoped to client-portal.
// PROVISIONAL: this is the external client-facing portal (document sharing, e-signatures) - no
// backend module or routes exist for it yet (see api/index.ts's header comment). These describe
// the eventual API contract only, distinct from the internal Documents module's real DocumentFile.

export interface SharedDocument {
  id: string
  fileName: string
  category: string
  sizeBytes: number
  sharedAt: string
}

export interface SharedDocumentListFilters {
  page?: number
  limit?: number
  search?: string
}

export interface ClientPortalSummary {
  documentsSharedCount: number
  pendingSignaturesCount: number
}
