import { z } from 'zod';
import {
  createDocumentSchema,
  updateDocumentSchema,
  listDocumentsQuerySchema,
  shareDocumentSchema,
} from '../schemas/document.schema';

/**
 * Request DTOs — inferred from the Zod schemas in `schemas/document.schema.ts`.
 * These are the shapes controllers/services receive AFTER `validate()` has run.
 */

export type CreateDocumentDto = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentDto = z.infer<typeof updateDocumentSchema>;
export type ListDocumentsQueryDto = z.infer<typeof listDocumentsQuerySchema>;
export type ShareDocumentDto = z.infer<typeof shareDocumentSchema>;
