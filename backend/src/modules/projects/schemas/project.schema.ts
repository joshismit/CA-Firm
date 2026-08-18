import { z } from 'zod';
import { ProjectStatus } from '@prisma/client';
import { searchPaginationSchema } from '@shared/validators';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Project Validation Schemas
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * All schemas are plain `ZodObject`s (no `.refine()`/`.superRefine()` at the
 * top level) because `validate()` (@middlewares/validation.middleware) types
 * its `body`/`params`/`query` options as `AnyZodObject` — a `.refine()` call
 * returns a `ZodEffects` wrapper that is not assignable to `AnyZodObject`.
 * Cross-field checks (e.g. dueDate >= startDate) are therefore validated in
 * `ProjectService`, not here.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const uuid = z.string().uuid('Must be a valid UUID');

/** Engagement code: letters, numbers, and - / _ . separators only. */
const projectCode = z
  .string()
  .trim()
  .min(2, 'Code must be at least 2 characters')
  .max(50, 'Code cannot exceed 50 characters')
  .regex(/^[A-Za-z0-9\-/_.]+$/, 'Code may only contain letters, numbers, and - / _ . characters');

const projectName = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(255, 'Name cannot exceed 255 characters');

// ─── Create ───────────────────────────────────────────────────────────────────

export const createProjectSchema = z.object({
  clientId: uuid,
  managerId: uuid.optional(),
  code: projectCode,
  name: projectName,
  startDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
});

// ─── Update ───────────────────────────────────────────────────────────────────

export const updateProjectSchema = z.object({
  managerId: uuid.nullable().optional(),
  name: projectName.optional(),
  startDate: z.coerce.date().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
});

// ─── Status Transition ────────────────────────────────────────────────────────

export const updateProjectStatusSchema = z.object({
  status: z.nativeEnum(ProjectStatus),
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(500).optional(),
});

// ─── Params ───────────────────────────────────────────────────────────────────

export const projectIdParamSchema = z.object({ id: uuid });
export const projectCodeParamSchema = z.object({ code: z.string().trim().min(1).max(50) });
export const clientIdParamSchema = z.object({ clientId: uuid });
export const managerIdParamSchema = z.object({ managerId: uuid });

// ─── List / Search Query ──────────────────────────────────────────────────────

export const listProjectsQuerySchema = searchPaginationSchema.extend({
  status: z.nativeEnum(ProjectStatus).optional(),
  clientId: uuid.optional(),
  managerId: uuid.optional(),
  dueBefore: z.coerce.date().optional(),
  dueAfter: z.coerce.date().optional(),
});
