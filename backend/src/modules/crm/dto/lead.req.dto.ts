import { z } from 'zod';
import {
  createLeadSchema,
  updateLeadSchema,
  listLeadsQuerySchema,
  convertLeadSchema,
} from '../schemas/lead.schema';

/**
 * Request DTOs — inferred from the Zod schemas in `schemas/lead.schema.ts`.
 * These are the shapes controllers/services receive AFTER `validate()` has run.
 */

export type CreateLeadDto = z.infer<typeof createLeadSchema>;
export type UpdateLeadDto = z.infer<typeof updateLeadSchema>;
export type ListLeadsQueryDto = z.infer<typeof listLeadsQuerySchema>;
export type ConvertLeadDto = z.infer<typeof convertLeadSchema>;
