import { z } from 'zod';
import {
  createTaskTemplateSchema,
  updateTaskTemplateSchema,
  instantiateTaskTemplateSchema,
  listTaskTemplatesQuerySchema,
} from '../schemas/task-template.schema';

/**
 * Request DTOs — inferred from the Zod schemas in `schemas/task-template.schema.ts`.
 * These are the shapes controllers/services receive AFTER `validate()` has run.
 */

export type CreateTaskTemplateDto = z.infer<typeof createTaskTemplateSchema>;
export type UpdateTaskTemplateDto = z.infer<typeof updateTaskTemplateSchema>;
export type InstantiateTaskTemplateDto = z.infer<typeof instantiateTaskTemplateSchema>;
export type ListTaskTemplatesQueryDto = z.infer<typeof listTaskTemplatesQuerySchema>;
