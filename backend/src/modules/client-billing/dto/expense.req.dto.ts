import { z } from 'zod';
import { createExpenseSchema, updateExpenseSchema, expenseIdParamSchema, listExpensesQuerySchema } from '../schemas/expense.schema';

export type CreateExpenseDto = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseDto = z.infer<typeof updateExpenseSchema>;
export type ExpenseIdParamDto = z.infer<typeof expenseIdParamSchema>;
export type ListExpensesQueryDto = z.infer<typeof listExpensesQuerySchema>;
