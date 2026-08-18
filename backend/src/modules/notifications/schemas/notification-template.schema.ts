import { z } from 'zod';
import { NotificationChannel } from '@prisma/client';
import { searchPaginationSchema } from '@shared/validators';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Notification Template Validation Schemas
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Plain `ZodObject`s only (no `.refine()`) — `validate()` requires
 * `AnyZodObject`, same reasoning as `task-template.schema.ts`'s header
 * comment. `subjectTemplate`/`bodyTemplateHtml` are accepted for every
 * channel rather than refined to EMAIL-only — a non-EMAIL template simply
 * never has them rendered (see `NotificationTemplateRenderer`).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const uuid = z.string().uuid('Must be a valid UUID');

const templateKey = z
  .string()
  .trim()
  .min(2, 'Key must be at least 2 characters')
  .max(100, 'Key cannot exceed 100 characters')
  .regex(/^[a-z0-9-]+$/, 'Key may only contain lowercase letters, digits, and hyphens');

const templateName = z.string().trim().min(2, 'Name must be at least 2 characters').max(255, 'Name cannot exceed 255 characters');

export const createNotificationTemplateSchema = z.object({
  key: templateKey,
  channel: z.nativeEnum(NotificationChannel),
  name: templateName,
  description: z.string().trim().max(1000).optional(),
  subjectTemplate: z.string().trim().max(255).optional(),
  bodyTemplateText: z.string().trim().min(1, 'Body template is required').max(10000),
  bodyTemplateHtml: z.string().trim().max(20000).optional(),
});

export const updateNotificationTemplateSchema = z.object({
  name: templateName.optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  subjectTemplate: z.string().trim().max(255).nullable().optional(),
  bodyTemplateText: z.string().trim().min(1).max(10000).optional(),
  bodyTemplateHtml: z.string().trim().max(20000).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const notificationTemplateIdParamSchema = z.object({ id: uuid });

export const listNotificationTemplatesQuerySchema = searchPaginationSchema.extend({
  channel: z.nativeEnum(NotificationChannel).optional(),
  isActive: z.coerce.boolean().optional(),
});
