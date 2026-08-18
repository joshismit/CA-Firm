import { z } from 'zod';
import { LeadPriority } from '@prisma/client';
import { searchPaginationSchema, paginationSchema } from '@shared/validators';

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
// PRD §8.4 — free-text list, capped per-item and overall so a client can't send an unbounded array.
const interestedServices = z.array(z.string().trim().min(1).max(100)).max(50, 'Cannot exceed 50 interested services');
const proposalValue = z.coerce.number().min(0, 'Proposal value cannot be negative');
const proposalRemarks = z.string().trim().max(2000, 'Proposal remarks cannot exceed 2000 characters');

// ─── Create ───────────────────────────────────────────────────────────────────

export const createLeadSchema = z.object({
  businessId: uuid.optional(),
  contactId: uuid.optional(),
  title,
  sourceId: uuid,
  stageId: uuid,
  priority: z.nativeEnum(LeadPriority).optional(),
  expectedRevenue: expectedRevenue.optional(),
  probability: probability.optional(),
  expectedCloseDate: z.coerce.date().optional(),
  interestedServices: interestedServices.optional(),
});

// ─── Update ───────────────────────────────────────────────────────────────────

export const updateLeadSchema = z.object({
  businessId: uuid.nullable().optional(),
  contactId: uuid.nullable().optional(),
  title: title.optional(),
  sourceId: uuid.optional(),
  stageId: uuid.optional(),
  priority: z.nativeEnum(LeadPriority).nullable().optional(),
  expectedRevenue: expectedRevenue.nullable().optional(),
  probability: probability.nullable().optional(),
  expectedCloseDate: z.coerce.date().nullable().optional(),
  interestedServices: interestedServices.optional(),
});

// ─── Proposal (PRD §8.2) ────────────────────────────────────────────────────────
// Dedicated action schemas — not a raw PATCH — so `proposalSentAt`/`proposalAcceptedAt`/
// `proposalRejectedAt` can never be set out of order by a client. Mirrors `convertLeadSchema`'s
// identical "the lead comes from the :id param, the body is just the action's own payload" shape.

export const sendProposalSchema = z.object({
  proposalValue: proposalValue.optional(),
  proposalRemarks: proposalRemarks.optional(),
});

export const respondProposalSchema = z.object({
  proposalRemarks: proposalRemarks.optional(),
});

// ─── Params ───────────────────────────────────────────────────────────────────

export const leadIdParamSchema = z.object({ id: uuid });

/** PRD §8.11 — pagination for `GET /crm/:id/timeline`. */
export const leadTimelineQuerySchema = paginationSchema;

// ─── List / Search Query ──────────────────────────────────────────────────────

export const listLeadsQuerySchema = searchPaginationSchema.extend({
  stageId: uuid.optional(),
  sourceId: uuid.optional(),
  priority: z.nativeEnum(LeadPriority).optional(),
});

// ─── Conversion ───────────────────────────────────────────────────────────────

export const convertLeadSchema = z.object({
  notes: notes.optional(),
});

// ─── Notes (PRD §8.6) ───────────────────────────────────────────────────────────

export const createLeadNoteSchema = z.object({
  content: z.string().trim().min(1, 'Content is required').max(5000, 'Content cannot exceed 5000 characters'),
  documentId: uuid.optional(),
});

// ─── Staff Assignment (PRD §8.5/§8.4) ────────────────────────────────────────
// `isPrimary` is the "lead owner" flag (PRD §8.4) — at most one per lead,
// enforced by `LeadAssignmentRepository.clearPrimaryForLead()`.

export const assignLeadSchema = z.object({
  userId: uuid,
  isPrimary: z.boolean().optional(),
});

export const leadAssignmentParamSchema = z.object({ id: uuid, userId: uuid });
