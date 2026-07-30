import { z } from 'zod';
import { PaymentStatus } from '@prisma/client';
import { searchPaginationSchema } from '@shared/validators';

/**
 * Field-for-field match with the frontend's already-built
 * `createPaymentSchema`/`updatePaymentSchema`
 * (frontend/src/modules/client-billing/schemas/index.ts). `method` is a
 * plain trimmed string, not `z.nativeEnum` — the frontend's own
 * `PAYMENT_METHOD_OPTIONS` is documented as "not backed by any real
 * payment-gateway integration yet".
 */

const uuid = z.string().uuid('Must be a valid UUID');

export const createPaymentSchema = z.object({
  paymentNumber: z.string().trim().min(2, 'Payment number must be at least 2 characters').max(50),
  invoiceId: uuid.optional(),
  amount: z.coerce.number().min(0, 'Amount cannot be negative'),
  method: z.string().trim().max(50).optional(),
  reference: z.string().trim().max(100).optional(),
  paidDate: z.coerce.date().optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const updatePaymentSchema = createPaymentSchema.partial();

export const paymentIdParamSchema = z.object({ id: uuid });

export const listPaymentsQuerySchema = searchPaginationSchema.extend({
  status: z.nativeEnum(PaymentStatus).optional(),
});
