import { z } from 'zod';
import {
  createBusinessSchema,
  updateBusinessSchema,
  listBusinessesQuerySchema,
  assignBusinessSchema,
  createBusinessNoteSchema,
  businessTimelineQuerySchema,
} from '../schemas/business.schema';

/**
 * Request DTOs — inferred from the Zod schemas in `schemas/business.schema.ts`.
 * These are the shapes controllers/services receive AFTER `validate()` has run.
 */

export type CreateBusinessDto = z.infer<typeof createBusinessSchema>;
export type UpdateBusinessDto = z.infer<typeof updateBusinessSchema>;
export type ListBusinessesQueryDto = z.infer<typeof listBusinessesQuerySchema>;
export type AssignBusinessDto = z.infer<typeof assignBusinessSchema>;
export type CreateBusinessNoteDto = z.infer<typeof createBusinessNoteSchema>;
export type BusinessTimelineQueryDto = z.infer<typeof businessTimelineQuerySchema>;
