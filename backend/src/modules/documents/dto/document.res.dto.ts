import { DocumentCategory, DocumentApprovalStatus } from '@prisma/client';

/**
 * Response DTO — the shape returned to API clients. Deliberately omits
 * internal-only fields (`tenantId`, `updatedAt`, `deletedAt`, `deletedBy`)
 * that have no value outside the server. Field-for-field match with the
 * frontend's already-built `DocumentFile` type
 * (frontend/src/modules/documents/types/index.ts), which predates this
 * schema and was marked PROVISIONAL pending backend design.
 */
export interface DocumentResponseDto {
  id: string;
  businessId: string | null;
  contactId: string | null;
  folderId: string | null;
  category: DocumentCategory;
  fileName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  isLatestVersion: boolean;
  rootDocumentId: string | null;
  previousVersionId: string | null;
  uploadedById: string;
  approvalStatus: DocumentApprovalStatus;
  reviewerId: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  createdAt: string;
}

/** PRD §7.2 rule 6 — returned as the `details` payload of the 409 thrown by `uploadDocument()` on a name conflict. */
export interface DocumentConflictDto {
  message: string;
  currentVersion: DocumentResponseDto;
  nextVersion: number;
}

/** Response DTO for a time-limited presigned download URL. */
export interface DocumentDownloadUrlResponseDto {
  url: string;
  expiresInSeconds: number;
}
