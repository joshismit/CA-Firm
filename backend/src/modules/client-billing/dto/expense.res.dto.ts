import { ExpenseStatus } from '@prisma/client';

/**
 * Response DTO — field-for-field match with the frontend's already-built
 * `Expense` type (frontend/src/modules/client-billing/types/index.ts).
 */
export interface ExpenseResponseDto {
  id: string;
  expenseNumber: string;
  category: string;
  vendor: string | null;
  amount: number;
  date: string | null;
  paymentMethod: string | null;
  status: ExpenseStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
