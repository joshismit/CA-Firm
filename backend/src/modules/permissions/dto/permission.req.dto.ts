import { z } from 'zod';
import { roleIdParamSchema, updatePermissionMatrixSchema } from '../schemas/permission.schema';

/**
 * Request DTOs — inferred from the Zod schemas in `schemas/permission.schema.ts`.
 * These are the shapes controllers/services receive AFTER `validate()` has run.
 */

export type RoleIdParamDto = z.infer<typeof roleIdParamSchema>;
export type UpdatePermissionMatrixDto = z.infer<typeof updatePermissionMatrixSchema>;
