import { z } from 'zod';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Permission Validation Schemas
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Field-for-field match with the frontend's already-built
 * `updatePermissionMatrixSchema` (frontend/src/modules/permissions/schemas/
 * index.ts). No create/update/delete schemas for `Permission` itself — the
 * catalog is system-owned and read-only (seeded via
 * `prisma/seeds/permissions.seed.ts`); only `RolePermission` grants are
 * mutable, via the matrix endpoints below.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const uuid = z.string().uuid('Must be a valid UUID');

export const roleIdParamSchema = z.object({ roleId: uuid });

export const updatePermissionMatrixSchema = z.object({
  roleId: uuid,
  permissionId: uuid,
  granted: z.boolean(),
});
