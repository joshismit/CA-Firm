import { z } from 'zod';
import { ExpenseStatus } from '@prisma/client';
import { searchPaginationSchema } from '@shared/validators';

/**
 * Field-for-field match with the frontend's already-built
 * `createExpenseSchema`/`updateExpenseSchema`
 * (frontend/src/modules/client-billing/schemas/index.ts). `category` is a
 * plain trimmed string, not `z.nativeEnum` — the frontend's own
 * `EXPENSE_CATEGORY_OPTIONS` is documented as "not backed by any real
 * taxonomy yet", so this must not invent a stricter server-side enum than
 * the frontend itself commits to.
 */

const uuid = z.string().uuid('Must be a valid UUID');

export const createExpenseSchema = z.object({
  expenseNumber: z.string().trim().min(2, 'Expense number must be at least 2 characters').max(50),
  category: z.string().trim().min(1, 'Select a category').max(100),
  vendor: z.string().trim().max(255).optional(),
  amount: z.coerce.number().min(0, 'Amount cannot be negative'),
  date: z.coerce.date().optional(),
  paymentMethod: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export const expenseIdParamSchema = z.object({ id: uuid });

export const listExpensesQuerySchema = searchPaginationSchema.extend({
  status: z.nativeEnum(ExpenseStatus).optional(),
  category: z.string().trim().max(100).optional(),
});
