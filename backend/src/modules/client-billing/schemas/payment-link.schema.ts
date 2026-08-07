import { z } from 'zod';

const uuid = z.string().uuid('Must be a valid UUID');

export const createPaymentLinkSchema = z.object({
  invoiceId: uuid,
  /** Defaults to 7 days (`BillingReminderService`'s own reminder cadence uses the same window) if omitted. */
  expiresInHours: z.coerce.number().int().min(1).max(720).optional(),
  customerName: z.string().trim().max(255).optional(),
  customerEmail: z.string().trim().email().optional(),
  customerContact: z.string().trim().max(20).optional(),
});

export const paymentLinkIdParamSchema = z.object({ id: uuid });

export const listPaymentLinksQuerySchema = z.object({
  invoiceId: uuid,
});
