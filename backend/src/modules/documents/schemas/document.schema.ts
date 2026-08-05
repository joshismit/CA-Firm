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
 * (`category`/`businessId`/`contactId`/`folderId`) — the file itself arrives
 * as `req.file` via `multer` (see `routes/document.routes.ts`), never through
 * this schema, and its mime-type/size are validated in
 * `DocumentService.uploadDocument()` against the shared `UPLOAD` constants
 * (not duplicated here).
 *
 * PRD §7.1 rule 1 ("never introduce tenant-level orphan documents") — a
 * document must be anchored to at least one of `businessId`/`contactId` — is
 * a cross-field rule this file's plain-`ZodObject` schemas can't express (see
 * this header's "no `.refine()`" note above); it's enforced in
 * `DocumentService` instead, alongside the folder-consistency checks
 * (`folderId`'s Business/category must match the document's).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const uuid = z.string().uuid('Must be a valid UUID');
const category = z.nativeEnum(DocumentCategory);

// ─── Create (multipart form fields only — file is handled separately) ────────

/**
 * PRD §7.2 rule 7 — the multipart form's `createVersion` field is a plain
 * string ('true'/'false') like every other multer-parsed text field, so it's
 * coerced the same way `z.coerce.date()` is used elsewhere in this file.
 * Absent/false means "create a fresh document, or 409 on a name conflict";
 * true means "the caller already saw the 409 and confirmed — link this
 * upload as the next version instead." Transforms to `true | undefined`
 * (never a literal `false`) so the field stays optional on `CreateDocumentDto`
 * — every existing call site that never mentions versioning keeps compiling
 * unchanged; `DocumentService` only ever checks it via `!dto.createVersion`.
 */
const createVersionFlag = z
  .union([z.literal('true'), z.literal('false'), z.boolean()])
  .optional()
  .transform((value): true | undefined => (value === true || value === 'true' ? true : undefined));

export const createDocumentSchema = z.object({
  businessId: uuid.optional(),
  contactId: uuid.optional(),
  folderId: uuid.optional(),
  category,
  createVersion: createVersionFlag,
});

// ─── Update (metadata only — no file replacement) ─────────────────────────────

export const updateDocumentSchema = z.object({
  businessId: uuid.nullable().optional(),
  contactId: uuid.nullable().optional(),
  folderId: uuid.nullable().optional(),
  category: category.optional(),
});

// ─── Params ───────────────────────────────────────────────────────────────────

export const documentIdParamSchema = z.object({ id: uuid });

// ─── List / Search Query ──────────────────────────────────────────────────────

export const listDocumentsQuerySchema = searchPaginationSchema.extend({
  category: category.optional(),
  businessId: uuid.optional(),
  folderId: uuid.optional(),
  /** Bounds on `createdAt` (the upload date) — matches `modules/audit/schemas/audit.schema.ts`'s exact `from`/`to`, `lte: to`, no end-of-day adjustment convention. */
  uploadedFrom: z.coerce.date().optional(),
  uploadedTo: z.coerce.date().optional(),
});

// ─── Share ────────────────────────────────────────────────────────────────────

export const shareDocumentSchema = z.object({
  userId: uuid,
  expiresAt: z.string().datetime().optional(),
});
