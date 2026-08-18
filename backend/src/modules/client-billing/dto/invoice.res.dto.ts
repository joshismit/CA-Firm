import { InvoiceStatus } from '@prisma/client';

/**
 * Response DTO — field-for-field match with the frontend's already-built
 * `Invoice` type (frontend/src/modules/client-billing/types/index.ts).
 * `clientId`/`businessId` are the raw FK strings only — never a nested
 * Client/Business object.
 */
export interface InvoiceResponseDto {
  id: string;
  invoiceNumber: string;
  clientId: string | null;
  businessId: string | null;
  amount: number;
  tax: number;
  issuedDate: string | null;
  dueDate: string | null;
  status: InvoiceStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
