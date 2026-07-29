import { DocumentCategory } from '@prisma/client';

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
  category: DocumentCategory;
  fileName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  uploadedById: string;
  createdAt: string;
}

/** Response DTO for a time-limited presigned download URL. */
export interface DocumentDownloadUrlResponseDto {
  url: string;
  expiresInSeconds: number;
}
