import { Router } from 'express';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { requirePermission } from '@middlewares/permission.middleware';
import { validate } from '@middlewares/validation.middleware';
import { ROLE_PERMISSIONS } from '@modules/roles';
import { PermissionController } from '../controller/permission.controller';
import { roleIdParamSchema, updatePermissionMatrixSchema } from '../schemas/permission.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Permission Routes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every route runs: authMiddleware → tenantMiddleware → requirePermission →
 * validate → controller. Mirrors `modules/contacts/routes/contact.routes.ts`.
 *
 * Gated on `ROLE_PERMISSIONS.READ`/`MANAGE` (imported from `@modules/roles`)
 * rather than a dedicated "permissions" resource — the backend's
 * `PermissionResource` enum and the frontend's `PERMISSION_RESOURCES`
 * registry both have no such entry (viewing/editing the permission catalog
 * and grant matrix is treated as a role-management concern in both), so
 * this reuses the existing codes exactly rather than inventing new ones.
 *
 * Static-segment routes (`/groups`, `/matrix/...`) are registered before
 * `/:id` would be — there is no `/:id` route at all in this module (the
 * catalog has no single-resource GET; see `schemas/permission.schema.ts`'s
 * header comment), so there is no ordering hazard here, but the convention
 * is kept for consistency with every other module's routes file.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Permission:
 *       type: object
 *       description: A permission catalog entry — system-owned and read-only (seeded, never created/edited/deleted via the API).
 *       properties:
 *         id: { type: string, format: uuid }
 *         code: { type: string, example: 'users:read' }
 *         name: { type: string }
 *         description: { type: string, nullable: true }
 *         module: { type: string }
 *         action: { type: string, example: read }
 *         resource: { type: string, example: users }
 *         isSensitive: { type: boolean }
 *         groupId: { type: string, format: uuid, nullable: true }
 *       required: [id, code, name, module, action, resource, isSensitive]
 *     PermissionGroup:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         name: { type: string }
 *         description: { type: string, nullable: true }
 *         module: { type: string }
 *         displayOrder: { type: integer }
 *       required: [id, name, module, displayOrder]
 *     PermissionMatrixEntry:
 *       type: object
 *       properties:
 *         roleId: { type: string, format: uuid }
 *         permissionId: { type: string, format: uuid }
 *         granted: { type: boolean }
 *       required: [roleId, permissionId, granted]
 *     UpdatePermissionMatrixRequest:
 *       type: object
 *       required: [roleId, permissionId, granted]
 *       properties:
 *         roleId: { type: string, format: uuid }
 *         permissionId: { type: string, format: uuid }
 *         granted: { type: boolean }
 *   parameters:
 *     MatrixRoleIdParam:
 *       name: roleId
 *       in: path
 *       required: true
 *       schema: { type: string, format: uuid }
 *       description: Role ID.
 */

/**
 * @swagger
 * /permissions:
 *   get:
 *     tags: [Permissions]
 *     summary: List the full permission catalog
 *     description: Returns every Permission in one call — a small, system-owned reference catalog, not paginated. Filtering (search/resource/action) happens client-side over this single fetch.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: roles:read
 *     responses:
 *       200: { description: The full permission catalog. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `roles:read` permission. }
 */
router.get('/', authMiddleware, tenantMiddleware, requirePermission(ROLE_PERMISSIONS.READ), PermissionController.list);

/**
 * @swagger
 * /permissions/groups:
 *   get:
 *     tags: [Permissions]
 *     summary: List permission groups
 *     security: [{ BearerAuth: [] }]
 *     x-permission: roles:read
 *     responses:
 *       200: { description: The permission groups. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `roles:read` permission. }
 */
router.get('/groups', authMiddleware, tenantMiddleware, requirePermission(ROLE_PERMISSIONS.READ), PermissionController.listGroups);

/**
 * @swagger
 * /permissions/matrix/{roleId}:
 *   get:
 *     tags: [Permissions]
 *     summary: Get the full permission matrix for a role
 *     description: Returns one entry per catalog Permission, each flagged with whether the role currently holds it.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: roles:read
 *     parameters: [{ $ref: '#/components/parameters/MatrixRoleIdParam' }]
 *     responses:
 *       200: { description: The role's permission matrix. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `roles:read` permission. }
 *       404: { description: No role with this ID exists in the tenant. }
 *       422: { description: roleId is not a valid UUID. }
 */
router.get(
  '/matrix/:roleId',
  authMiddleware,
  tenantMiddleware,
  requirePermission(ROLE_PERMISSIONS.READ),
  validate({ params: roleIdParamSchema }),
  PermissionController.getMatrix,
);

/**
 * @swagger
 * /permissions/matrix:
 *   patch:
 *     tags: [Permissions]
 *     summary: Grant or revoke a single permission for a role
 *     description: Toggles exactly one RolePermission grant — does not affect the role's other permissions. Rejected with 403 for SYSTEM roles (immutable).
 *     security: [{ BearerAuth: [] }]
 *     x-permission: roles:manage
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/UpdatePermissionMatrixRequest' } } }
 *     responses:
 *       200: { description: Permission grant updated. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks roles:manage, or the role is a SYSTEM role. }
 *       404: { description: The role or permission does not exist. }
 *       422: { description: Validation failed. }
 */
router.patch(
  '/matrix',
  authMiddleware,
  tenantMiddleware,
  requirePermission(ROLE_PERMISSIONS.MANAGE),
  validate({ body: updatePermissionMatrixSchema }),
  PermissionController.updateMatrix,
);

export default router;
