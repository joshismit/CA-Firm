import { z } from 'zod';
import {
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
  listTasksQuerySchema,
} from '../schemas/task.schema';

/**
 * Request DTOs — inferred from the Zod schemas in `schemas/task.schema.ts`.
 * These are the shapes controllers/services receive AFTER `validate()` has run.
 */

export type CreateTaskDto = z.infer<typeof createTaskSchema>;
export type UpdateTaskDto = z.infer<typeof updateTaskSchema>;
export type UpdateTaskStatusDto = z.infer<typeof updateTaskStatusSchema>;
export type ListTasksQueryDto = z.infer<typeof listTasksQuerySchema>;
