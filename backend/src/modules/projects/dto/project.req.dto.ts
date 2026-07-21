import { z } from 'zod';
import {
  createProjectSchema,
  updateProjectSchema,
  updateProjectStatusSchema,
  listProjectsQuerySchema,
} from '../schemas/project.schema';

/**
 * Request DTOs — inferred from the Zod schemas in `schemas/project.schema.ts`.
 * These are the shapes controllers/services receive AFTER `validate()` has run.
 */

export type CreateProjectDto = z.infer<typeof createProjectSchema>;
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;
export type UpdateProjectStatusDto = z.infer<typeof updateProjectStatusSchema>;
export type ListProjectsQueryDto = z.infer<typeof listProjectsQuerySchema>;
