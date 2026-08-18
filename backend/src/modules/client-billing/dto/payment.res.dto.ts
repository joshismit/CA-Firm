import { PaymentStatus } from '@prisma/client';

/**
 * Response DTO — field-for-field match with the frontend's already-built
 * `Payment` type (frontend/src/modules/client-billing/types/index.ts).
 * `invoiceId` is the raw FK string only — never a nested Invoice object.
 */
export interface PaymentResponseDto {
  id: string;
  paymentNumber: string;
  invoiceId: string | null;
  amount: number;
  method: string | null;
  reference: string | null;
  paidDate: string | null;
  status: PaymentStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
