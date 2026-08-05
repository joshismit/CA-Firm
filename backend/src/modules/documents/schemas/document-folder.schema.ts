import { z } from 'zod';
import { DocumentCategory } from '@prisma/client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Document Folder Validation Schemas
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * All schemas are plain `ZodObject`s (no `.refine()`/`.superRefine()` at the
 * top level) for the same reason as `document.schema.ts`/`business.schema.ts`
 * (see those files' header comments — `validate()` types its options as
 * `AnyZodObject`). Cross-field rules (parent folder must belong to the same
 * Business/category, sibling name uniqueness, non-empty on delete) live in
 * `DocumentFolderService`, not here.
 *
 * `updateFolderSchema` only accepts `name` — PRD 7.1 rule 9 only calls for a
 * rename dialog (create/rename/delete), not re-parenting or moving a folder
 * to a different Business/category, so `businessId`/`category`/
 * `parentFolderId` are immutable after creation.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const uuid = z.string().uuid('Must be a valid UUID');
const folderName = z.string().trim().min(1, 'Name is required').max(255);
const category = z.nativeEnum(DocumentCategory);

// ─── Params ───────────────────────────────────────────────────────────────────

export const businessIdParamSchema = z.object({ businessId: uuid });

export const folderIdParamSchema = z.object({ id: uuid });

// ─── Create ───────────────────────────────────────────────────────────────────

export const createFolderSchema = z.object({
  category,
  parentFolderId: uuid.optional(),
  name: folderName,
});

// ─── Update (rename only) ───────────────────────────────────────────────────────

export const updateFolderSchema = z.object({
  name: folderName,
});

// ─── List (children of a Business, optionally scoped to one category) ─────────

export const listFoldersQuerySchema = z.object({
  category: category.optional(),
  parentFolderId: uuid.optional(),
});
