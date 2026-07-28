import { z } from 'zod';
import { searchPaginationSchema } from '@shared/validators';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Lead Validation Schemas
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * All schemas are plain `ZodObject`s (no `.refine()`/`.superRefine()` at the
 * top level) — mirrors `modules/business/schemas/business.schema.ts` and
 * `modules/contacts/schemas/contact.schema.ts`, see those files' header
 * comments for why.
 *
 * `convertLeadSchema` only validates `notes` — the lead being converted comes
 * from the `:id` route param (`leadIdParamSchema`), not the body. The
 * frontend's `ConvertLeadPayload` type bundles `{leadId, notes}` together,
 * but that's a client-side convenience; the wire format matches this
 * schema (see `modules/crm/routes/lead.routes.ts`).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const uuid = z.string().uuid('Must be a valid UUID');

const title = z.string().trim().min(2, 'Title must be at least 2 characters').max(255, 'Title cannot exceed 255 characters');
const probability = z.coerce.number().int().min(0, 'Probability cannot be negative').max(100, 'Probability cannot exceed 100');
const expectedRevenue = z.coerce.number().min(0, 'Expected revenue cannot be negative');
const notes = z.string().trim().max(1000, 'Notes cannot exceed 1000 characters');

// ─── Create ───────────────────────────────────────────────────────────────────

export const createLeadSchema = z.object({
  businessId: uuid.optional(),
  contactId: uuid.optional(),
  title,
  sourceId: uuid,
  stageId: uuid,
  expectedRevenue: expectedRevenue.optional(),
  probability: probability.optional(),
  expectedCloseDate: z.coerce.date().optional(),
});

// ─── Update ───────────────────────────────────────────────────────────────────

export const updateLeadSchema = z.object({
  businessId: uuid.nullable().optional(),
  contactId: uuid.nullable().optional(),
  title: title.optional(),
  sourceId: uuid.optional(),
  stageId: uuid.optional(),
  expectedRevenue: expectedRevenue.nullable().optional(),
  probability: probability.nullable().optional(),
  expectedCloseDate: z.coerce.date().nullable().optional(),
});

// ─── Params ───────────────────────────────────────────────────────────────────

export const leadIdParamSchema = z.object({ id: uuid });

// ─── List / Search Query ──────────────────────────────────────────────────────

export const listLeadsQuerySchema = searchPaginationSchema.extend({
  stageId: uuid.optional(),
  sourceId: uuid.optional(),
});

// ─── Conversion ───────────────────────────────────────────────────────────────

export const convertLeadSchema = z.object({
  notes: notes.optional(),
});
