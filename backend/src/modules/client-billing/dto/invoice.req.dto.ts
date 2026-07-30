import { z } from 'zod';
import { createInvoiceSchema, updateInvoiceSchema, invoiceIdParamSchema, listInvoicesQuerySchema } from '../schemas/invoice.schema';

export type CreateInvoiceDto = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceDto = z.infer<typeof updateInvoiceSchema>;
export type InvoiceIdParamDto = z.infer<typeof invoiceIdParamSchema>;
export type ListInvoicesQueryDto = z.infer<typeof listInvoicesQuerySchema>;
