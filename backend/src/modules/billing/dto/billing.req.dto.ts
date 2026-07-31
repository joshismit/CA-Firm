import { z } from 'zod';
import {
  createCheckoutSessionSchema,
  createPlanSchema,
  listInvoicesQuerySchema,
  listPlansQuerySchema,
  updatePlanSchema,
  verifyCheckoutPaymentSchema,
} from '../schemas/billing.schema';

/**
 * Request DTOs — inferred from the Zod schemas in `schemas/billing.schema.ts`.
 * These are the shapes controllers/services receive AFTER `validate()` has run.
 */

export type CreatePlanDto = z.infer<typeof createPlanSchema>;
export type UpdatePlanDto = z.infer<typeof updatePlanSchema>;
export type ListPlansQueryDto = z.infer<typeof listPlansQuerySchema>;
export type CreateCheckoutSessionDto = z.infer<typeof createCheckoutSessionSchema>;
export type VerifyCheckoutPaymentDto = z.infer<typeof verifyCheckoutPaymentSchema>;
export type ListInvoicesQueryDto = z.infer<typeof listInvoicesQuerySchema>;
