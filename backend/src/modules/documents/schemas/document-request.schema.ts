import { z } from 'zod';
import { DocumentCategory, DocumentRequestStatus } from '@prisma/client';
import { searchPaginationSchema } from '@shared/validators';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Document Request Validation Schemas (PRD §11.4/§11.12)
 * ─────────────────────────────────────────────────────────────────────────────
 * Plain `ZodObject`s only (no `.refine()`) — same reasoning as
 * `task-template.schema.ts`'s header comment.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const uuid = z.string().uuid('Must be a valid UUID');

export const createDocumentRequestSchema = z.object({
  businessId: uuid,
  category: z.nativeEnum(DocumentCategory),
  description: z.string().trim().max(1000).optional(),
  dueDate: z.coerce.date().optional(),
});

export const updateDocumentRequestSchema = z.object({
  description: z.string().trim().max(1000).nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
});

export const fulfillDocumentRequestSchema = z.object({
  documentId: uuid,
});

export const documentRequestIdParamSchema = z.object({ id: uuid });

export const listDocumentRequestsQuerySchema = searchPaginationSchema.extend({
  businessId: uuid.optional(),
  category: z.nativeEnum(DocumentCategory).optional(),
  status: z.nativeEnum(DocumentRequestStatus).optional(),
});
