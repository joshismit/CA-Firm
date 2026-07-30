import { z } from 'zod';
import { createPaymentSchema, updatePaymentSchema, paymentIdParamSchema, listPaymentsQuerySchema } from '../schemas/payment.schema';

export type CreatePaymentDto = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentDto = z.infer<typeof updatePaymentSchema>;
export type PaymentIdParamDto = z.infer<typeof paymentIdParamSchema>;
export type ListPaymentsQueryDto = z.infer<typeof listPaymentsQuerySchema>;
