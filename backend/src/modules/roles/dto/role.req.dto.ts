import { z } from 'zod';
import { createRoleSchema, updateRoleSchema, roleIdParamSchema, listRolesQuerySchema, assignRoleSchema } from '../schemas/role.schema';

/**
 * Request DTOs — inferred from the Zod schemas in `schemas/role.schema.ts`.
 * These are the shapes controllers/services receive AFTER `validate()` has run.
 */

export type CreateRoleDto = z.infer<typeof createRoleSchema>;
export type UpdateRoleDto = z.infer<typeof updateRoleSchema>;
export type RoleIdParamDto = z.infer<typeof roleIdParamSchema>;
export type ListRolesQueryDto = z.infer<typeof listRolesQuerySchema>;
export type AssignRoleDto = z.infer<typeof assignRoleSchema>;
