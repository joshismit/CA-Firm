import { z } from 'zod';
import { TaskType, TaskPriority } from '@prisma/client';
import { searchPaginationSchema } from '@shared/validators';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Task Template Validation Schemas
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Plain `ZodObject`s only (no `.refine()`), same reasoning as `task.schema.ts`'s
 * own header comment — `validate()` requires `AnyZodObject`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const uuid = z.string().uuid('Must be a valid UUID');

const templateName = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(255, 'Name cannot exceed 255 characters');

const titleTemplate = z
  .string()
  .trim()
  .min(2, 'Title template must be at least 2 characters')
  .max(255, 'Title template cannot exceed 255 characters');

const descriptionTemplate = z.string().trim().max(5000, 'Description template cannot exceed 5000 characters');

// ─── Create ───────────────────────────────────────────────────────────────────

export const createTaskTemplateSchema = z.object({
  name: templateName,
  type: z.nativeEnum(TaskType),
  titleTemplate,
  descriptionTemplate: descriptionTemplate.optional(),
  defaultPriority: z.nativeEnum(TaskPriority).optional(),
  dueInDays: z.coerce.number().int().min(0).max(3650).optional(),
});

// ─── Update ───────────────────────────────────────────────────────────────────

export const updateTaskTemplateSchema = z.object({
  name: templateName.optional(),
  type: z.nativeEnum(TaskType).optional(),
  titleTemplate: titleTemplate.optional(),
  descriptionTemplate: descriptionTemplate.nullable().optional(),
  defaultPriority: z.nativeEnum(TaskPriority).nullable().optional(),
  dueInDays: z.coerce.number().int().min(0).max(3650).nullable().optional(),
  isActive: z.boolean().optional(),
});

// ─── Instantiate ────────────────────────────────────────────────────────────

export const instantiateTaskTemplateSchema = z.object({
  title: z.string().trim().min(2).max(255).optional(),
  description: z.string().trim().max(5000).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  dueDate: z.coerce.date().optional(),
  projectId: uuid.optional(),
  leadId: uuid.optional(),
  assigneeId: uuid.optional(),
  businessId: uuid.optional(),
  contactId: uuid.optional(),
  clientId: uuid.optional(),
});

// ─── Params ───────────────────────────────────────────────────────────────────

export const taskTemplateIdParamSchema = z.object({ id: uuid });

// ─── List / Search Query ──────────────────────────────────────────────────────

export const listTaskTemplatesQuerySchema = searchPaginationSchema.extend({
  type: z.nativeEnum(TaskType).optional(),
  isActive: z.coerce.boolean().optional(),
});
