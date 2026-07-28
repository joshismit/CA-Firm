import { z } from 'zod';
import { ContactRoleType } from '@prisma/client';
import { searchPaginationSchema, panSchema } from '@shared/validators';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Contact Validation Schemas
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * All schemas are plain `ZodObject`s (no `.refine()`/`.superRefine()` at the
 * top level) — mirrors `modules/business/schemas/business.schema.ts`, see that
 * file's header comment for why.
 *
 * `assignContactRoleSchema` carries `contactId` in the body rather than being
 * nested under `/contacts/:id/roles` — this exactly matches the frontend's
 * already-built `AssignContactRolePayload` type and `useAssignContactRoleMutation`
 * hook (modules/contacts/types|hooks on the frontend, built in an earlier
 * phase before this backend existed), which pass the full payload in one call
 * rather than an `:id` param + a smaller body.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const uuid = z.string().uuid('Must be a valid UUID');

const firstName = z
  .string()
  .trim()
  .min(1, 'First name is required')
  .max(100, 'First name cannot exceed 100 characters');

const lastName = z.string().trim().max(100, 'Last name cannot exceed 100 characters');
const email = z.string().trim().email('Enter a valid email address');
const phone = z.string().trim().max(30, 'Phone cannot exceed 30 characters');
const customTitle = z.string().trim().max(100, 'Custom title cannot exceed 100 characters');
const sharePercent = z.coerce.number().min(0, 'Share percent cannot be negative').max(100, 'Share percent cannot exceed 100');

// ─── Create ───────────────────────────────────────────────────────────────────

export const createContactSchema = z.object({
  firstName,
  lastName: lastName.optional(),
  email: email.optional(),
  phone: phone.optional(),
  pan: panSchema.optional(),
});

// ─── Update ───────────────────────────────────────────────────────────────────

export const updateContactSchema = z.object({
  firstName: firstName.optional(),
  lastName: lastName.nullable().optional(),
  email: email.nullable().optional(),
  phone: phone.nullable().optional(),
  pan: panSchema.nullable().optional(),
});

// ─── Params ───────────────────────────────────────────────────────────────────

export const contactIdParamSchema = z.object({ id: uuid });

// ─── List / Search Query ──────────────────────────────────────────────────────

export const listContactsQuerySchema = searchPaginationSchema.extend({
  businessId: uuid.optional(),
});

// ─── Contact Role Assignment ────────────────────────────────────────────────────

export const assignContactRoleSchema = z.object({
  businessId: uuid,
  contactId: uuid,
  roleType: z.nativeEnum(ContactRoleType),
  customTitle: customTitle.optional(),
  isPrimary: z.coerce.boolean().optional(),
  sharePercent: sharePercent.optional(),
});
