import { z } from 'zod';
import { TaskStatus, TaskType, TaskPriority } from '@prisma/client';
import { searchPaginationSchema } from '@shared/validators';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Task Validation Schemas
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * All schemas are plain `ZodObject`s (no `.refine()`/`.superRefine()` at the
 * top level) because `validate()` (@middlewares/validation.middleware) types
 * its `body`/`params`/`query` options as `AnyZodObject` — a `.refine()` call
 * returns a `ZodEffects` wrapper that is not assignable to `AnyZodObject`.
 * Cross-field checks (e.g. dueDate >= startDate, completedAt rules) are
 * therefore validated in `TaskService`, not here — mirrors
 * `modules/projects/schemas/project.schema.ts`.
 *
 * TODO: once labels/milestones/subtasks/dependencies/time-tracking/comments/
 * attachments exist, their own create/update payloads get their own schemas
 * in this file (or sibling files) — none of those concerns are modeled here.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const uuid = z.string().uuid('Must be a valid UUID');

const taskTitle = z
  .string()
  .trim()
  .min(2, 'Title must be at least 2 characters')
  .max(255, 'Title cannot exceed 255 characters');

const taskDescription = z.string().trim().max(5000, 'Description cannot exceed 5000 characters');

// ─── Create ───────────────────────────────────────────────────────────────────

export const createTaskSchema = z.object({
  projectId: uuid.optional(),
  /** PRD §8.7 — links a follow-up task to a CRM Lead (pre-conversion, no Project yet). */
  leadId: uuid.optional(),
  assigneeId: uuid.optional(),
  /** PRD §9 — ownership/context links, all optional and independent of one another. */
  businessId: uuid.optional(),
  contactId: uuid.optional(),
  clientId: uuid.optional(),
  documentId: uuid.optional(),
  folderId: uuid.optional(),
  /** PRD §9 — presence of `type` puts the task on the approval-workflow lifecycle (starts REQUESTED). */
  type: z.nativeEnum(TaskType).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  title: taskTitle,
  description: taskDescription.optional(),
  startDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
});

// ─── Update ───────────────────────────────────────────────────────────────────

export const updateTaskSchema = z.object({
  projectId: uuid.nullable().optional(),
  leadId: uuid.nullable().optional(),
  assigneeId: uuid.nullable().optional(),
  businessId: uuid.nullable().optional(),
  contactId: uuid.nullable().optional(),
  clientId: uuid.nullable().optional(),
  documentId: uuid.nullable().optional(),
  folderId: uuid.nullable().optional(),
  type: z.nativeEnum(TaskType).nullable().optional(),
  priority: z.nativeEnum(TaskPriority).nullable().optional(),
  title: taskTitle.optional(),
  description: taskDescription.nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
});

// ─── Status Transition ────────────────────────────────────────────────────────

export const updateTaskStatusSchema = z.object({
  status: z.nativeEnum(TaskStatus),
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(500).optional(),
});

// ─── Lifecycle actions (PRD §9) ────────────────────────────────────────────────

export const assignTaskSchema = z.object({
  assigneeId: uuid,
});

export const rejectTaskSchema = z.object({
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(500),
});

// ─── Params ───────────────────────────────────────────────────────────────────

export const taskIdParamSchema = z.object({ id: uuid });
export const projectIdParamSchema = z.object({ projectId: uuid });
export const leadIdParamSchema = z.object({ leadId: uuid });
export const assigneeIdParamSchema = z.object({ assigneeId: uuid });

// ─── List / Search Query ──────────────────────────────────────────────────────

export const listTasksQuerySchema = searchPaginationSchema.extend({
  status: z.nativeEnum(TaskStatus).optional(),
  projectId: uuid.optional(),
  leadId: uuid.optional(),
  assigneeId: uuid.optional(),
  type: z.nativeEnum(TaskType).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  dueBefore: z.coerce.date().optional(),
  dueAfter: z.coerce.date().optional(),
});
