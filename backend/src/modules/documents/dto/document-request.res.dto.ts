import { DocumentCategory, DocumentRequestStatus } from '@prisma/client';

export interface DocumentRequestResponseDto {
  id: string;
  businessId: string;
  category: DocumentCategory;
  description: string | null;
  dueDate: string | null;
  status: DocumentRequestStatus;
  requestedById: string;
  fulfilledDocumentId: string | null;
  fulfilledAt: string | null;
  createdAt: string;
  updatedAt: string;
}
