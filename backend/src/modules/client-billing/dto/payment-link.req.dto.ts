import { z } from 'zod';
import { createPaymentLinkSchema, paymentLinkIdParamSchema, listPaymentLinksQuerySchema } from '../schemas/payment-link.schema';

export type CreatePaymentLinkDto = z.infer<typeof createPaymentLinkSchema>;
export type PaymentLinkIdParamDto = z.infer<typeof paymentLinkIdParamSchema>;
export type ListPaymentLinksQueryDto = z.infer<typeof listPaymentLinksQuerySchema>;
