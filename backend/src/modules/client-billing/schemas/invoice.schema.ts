import { z } from 'zod';
import { InvoiceStatus } from '@prisma/client';
import { searchPaginationSchema } from '@shared/validators';

/**
 * Field-for-field match with the frontend's already-built
 * `createInvoiceSchema`/`updateInvoiceSchema`
 * (frontend/src/modules/client-billing/schemas/index.ts).
 */

const uuid = z.string().uuid('Must be a valid UUID');

export const createInvoiceSchema = z.object({
  invoiceNumber: z.string().trim().min(2, 'Invoice number must be at least 2 characters').max(50),
  clientId: uuid.optional(),
  businessId: uuid.optional(),
  amount: z.coerce.number().min(0, 'Amount cannot be negative'),
  tax: z.coerce.number().min(0, 'Tax cannot be negative').optional(),
  dueDate: z.coerce.date().optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const updateInvoiceSchema = createInvoiceSchema.partial();

export const invoiceIdParamSchema = z.object({ id: uuid });

export const listInvoicesQuerySchema = searchPaginationSchema.extend({
  status: z.nativeEnum(InvoiceStatus).optional(),
});
