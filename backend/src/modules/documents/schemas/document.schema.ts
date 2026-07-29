import { z } from 'zod';
import { DocumentCategory } from '@prisma/client';
import { searchPaginationSchema } from '@shared/validators';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Document Validation Schemas
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * All schemas are plain `ZodObject`s (no `.refine()`/`.superRefine()` at the
 * top level) — mirrors `modules/crm/schemas/lead.schema.ts`, see that file's
 * header comment for why.
 *
 * `createDocumentSchema` validates only the multipart form's text fields
 * (`category`/`businessId`/`contactId`) — the file itself arrives as
 * `req.file` via `multer` (see `routes/document.routes.ts`), never through
 * this schema, and its mime-type/size are validated in
 * `DocumentService.uploadDocument()` against the shared `UPLOAD` constants
 * (not duplicated here).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const uuid = z.string().uuid('Must be a valid UUID');
const category = z.nativeEnum(DocumentCategory);

// ─── Create (multipart form fields only — file is handled separately) ────────

export const createDocumentSchema = z.object({
  businessId: uuid.optional(),
  contactId: uuid.optional(),
  category,
});

// ─── Update (metadata only — no file replacement) ─────────────────────────────

export const updateDocumentSchema = z.object({
  businessId: uuid.nullable().optional(),
  contactId: uuid.nullable().optional(),
  category: category.optional(),
});

// ─── Params ───────────────────────────────────────────────────────────────────

export const documentIdParamSchema = z.object({ id: uuid });

// ─── List / Search Query ──────────────────────────────────────────────────────

export const listDocumentsQuerySchema = searchPaginationSchema.extend({
  category: category.optional(),
  businessId: uuid.optional(),
});
