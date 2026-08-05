import { DocumentCategory } from '@prisma/client';

/**
 * Response DTO — the shape returned to API clients. Deliberately omits
 * internal-only fields (`tenantId`, `deletedAt`, `deletedBy`) that have no
 * value outside the server. Mirrors `document.res.dto.ts`.
 */
export interface DocumentFolderResponseDto {
  id: string;
  businessId: string;
  category: DocumentCategory;
  parentFolderId: string | null;
  name: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}
