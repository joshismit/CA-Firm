import { z } from 'zod';
import { RoleType } from '@prisma/client';
import { searchPaginationSchema } from '@shared/validators';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Role Validation Schemas
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Field-for-field match with the frontend's already-built schemas
 * (frontend/src/modules/roles/schemas/index.ts) — `createRoleSchema`/
 * `updateRoleSchema` here mirror those exactly (same fields, same limits,
 * `updateRoleSchema` is a `.partial()` of `createRoleSchema` there too).
 * `permissionCodes` is a plain string array (not `z.nativeEnum` of anything)
 * because the frontend submits raw `resource:action` strings from its own
 * static registry (`config/permissions.config.ts`) — the service layer
 * resolves each code against the `Permission` table, not this schema.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const uuid = z.string().uuid('Must be a valid UUID');

export const createRoleSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  description: z.string().trim().max(500).optional(),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Enter a valid hex color')
    .optional(),
  permissionCodes: z.array(z.string()).min(1, 'Assign at least one permission'),
});

export const updateRoleSchema = createRoleSchema.partial();

// ─── Params ───────────────────────────────────────────────────────────────────

export const roleIdParamSchema = z.object({ id: uuid });

// ─── List / Search Query ──────────────────────────────────────────────────────

export const listRolesQuerySchema = searchPaginationSchema.extend({
  type: z.nativeEnum(RoleType).optional(),
});

// ─── Assign / Revoke ────────────────────────────────────────────────────────────

export const assignRoleSchema = z.object({
  userId: uuid,
  roleId: uuid,
  expiresAt: z.coerce.date().optional(),
});
