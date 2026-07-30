import { Router } from 'express';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { requirePermission } from '@middlewares/permission.middleware';
import { validate } from '@middlewares/validation.middleware';
import { RoleController } from '../controller/role.controller';
import { ROLE_PERMISSIONS } from '../constants/role.permissions';
import { createRoleSchema, updateRoleSchema, listRolesQuerySchema, roleIdParamSchema, assignRoleSchema } from '../schemas/role.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Role Routes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every route runs: authMiddleware → tenantMiddleware → requirePermission →
 * validate → controller. Mirrors `modules/contacts/routes/contact.routes.ts`.
 *
 * Static-segment routes (`/assign`, `/revoke`) are registered before `/:id`
 * — Express matches routes in registration order, and `/:id` would
 * otherwise swallow `/assign`/`/revoke` as an `:id` value.
 *
 * Gating uses only `ROLE_PERMISSIONS.READ`/`MANAGE` — the frontend's
 * permission registry never defines granular `roles:create`/`update`/
 * `delete` (see `constants/role.permissions.ts`), so every mutating route
 * here (create/update/delete/assign/revoke) is gated on `MANAGE` and every
 * read route on `READ`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     RoleType:
 *       type: string
 *       enum: [SYSTEM, CUSTOM]
 *     Role:
 *       type: object
 *       description: A role, as returned by the API — never the raw database row.
 *       properties:
 *         id: { type: string, format: uuid }
 *         name: { type: string }
 *         description: { type: string, nullable: true }
 *         color: { type: string, nullable: true, example: '#6366F1' }
 *         type: { $ref: '#/components/schemas/RoleType' }
 *         isActive: { type: boolean }
 *         permissionCodes: { type: array, items: { type: string }, example: ['users:read', 'users:manage'] }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *       required: [id, name, type, isActive, permissionCodes, createdAt, updatedAt]
 *     CreateRoleRequest:
 *       type: object
 *       required: [name, permissionCodes]
 *       properties:
 *         name: { type: string, minLength: 2, maxLength: 100 }
 *         description: { type: string, maxLength: 500 }
 *         color: { type: string, pattern: '^#[0-9A-Fa-f]{6}$' }
 *         permissionCodes: { type: array, items: { type: string }, minItems: 1 }
 *     UpdateRoleRequest:
 *       type: object
 *       description: Partial update. If permissionCodes is provided, it replaces the role's entire permission set (must have at least 1 entry).
 *       properties:
 *         name: { type: string, minLength: 2, maxLength: 100 }
 *         description: { type: string, maxLength: 500 }
 *         color: { type: string, pattern: '^#[0-9A-Fa-f]{6}$' }
 *         permissionCodes: { type: array, items: { type: string }, minItems: 1 }
 *     AssignRoleRequest:
 *       type: object
 *       required: [userId, roleId]
 *       properties:
 *         userId: { type: string, format: uuid }
 *         roleId: { type: string, format: uuid }
 *         expiresAt: { type: string, format: date-time }
 *   parameters:
 *     RoleIdParam:
 *       name: id
 *       in: path
 *       required: true
 *       schema: { type: string, format: uuid }
 *       description: Role ID.
 */

// ─── Static-segment routes (must precede /:id) ───────────────────────────────

/**
 * @swagger
 * /roles/assign:
 *   post:
 *     tags: [Roles]
 *     summary: Assign a role to a user
 *     description: >
 *       Rejected with 404 if the role or the user does not exist in this
 *       tenant (a cross-tenant userId is rejected here explicitly, since the
 *       UserRole.userId foreign key alone would not catch it — the user row
 *       exists, just in a different tenant). Rejected with 409 if this exact
 *       (user, role) assignment already exists.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: roles:manage
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/AssignRoleRequest' } } }
 *     responses:
 *       200: { description: Role assigned. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `roles:manage` permission. }
 *       404: { description: The role or user does not exist in this tenant. }
 *       409: { description: This user already has this role assigned. }
 *       422: { description: Validation failed. }
 */
router.post(
  '/assign',
  authMiddleware,
  tenantMiddleware,
  requirePermission(ROLE_PERMISSIONS.MANAGE),
  validate({ body: assignRoleSchema }),
  RoleController.assign,
);

/**
 * @swagger
 * /roles/revoke:
 *   post:
 *     tags: [Roles]
 *     summary: Revoke a role from a user
 *     security: [{ BearerAuth: [] }]
 *     x-permission: roles:manage
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/AssignRoleRequest' } } }
 *     responses:
 *       200: { description: Role revoked. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `roles:manage` permission. }
 *       404: { description: No such (user, role) assignment exists in this tenant. }
 *       422: { description: Validation failed. }
 */
router.post(
  '/revoke',
  authMiddleware,
  tenantMiddleware,
  requirePermission(ROLE_PERMISSIONS.MANAGE),
  validate({ body: assignRoleSchema }),
  RoleController.revoke,
);

/**
 * @swagger
 * /roles:
 *   get:
 *     tags: [Roles]
 *     summary: List roles
 *     description: Paginated, filterable, searchable list of roles scoped to the current tenant.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: roles:read
 *     parameters:
 *       - name: page
 *         in: query
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - name: sortBy
 *         in: query
 *         schema: { type: string, default: createdAt }
 *       - name: sortOrder
 *         in: query
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *       - name: search
 *         in: query
 *         description: Case-insensitive match against the role name.
 *         schema: { type: string, maxLength: 100 }
 *       - name: type
 *         in: query
 *         schema: { $ref: '#/components/schemas/RoleType' }
 *     responses:
 *       200: { description: Paginated list of roles. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `roles:read` permission. }
 *       422: { description: Invalid query parameters. }
 *   post:
 *     tags: [Roles]
 *     summary: Create a role
 *     description: Rejected with 404 if any permissionCodes entry does not resolve to a real Permission. Rejected with 409 for a duplicate role name within the tenant.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: roles:manage
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/CreateRoleRequest' } } }
 *     responses:
 *       201: { description: Role created. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `roles:manage` permission. }
 *       404: { description: One or more permissionCodes do not exist. }
 *       409: { description: A role with this name already exists in this tenant. }
 *       422: { description: Validation failed. }
 */
router.get(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(ROLE_PERMISSIONS.READ),
  validate({ query: listRolesQuerySchema }),
  RoleController.list,
);

router.post(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(ROLE_PERMISSIONS.MANAGE),
  validate({ body: createRoleSchema }),
  RoleController.create,
);

// ─── /:id routes ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /roles/{id}:
 *   get:
 *     tags: [Roles]
 *     summary: Get a role by ID
 *     security: [{ BearerAuth: [] }]
 *     x-permission: roles:read
 *     parameters: [{ $ref: '#/components/parameters/RoleIdParam' }]
 *     responses:
 *       200: { description: Role found. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `roles:read` permission. }
 *       404: { description: No role with this ID exists in the tenant. }
 *       422: { description: id is not a valid UUID. }
 *   patch:
 *     tags: [Roles]
 *     summary: Update a role
 *     description: Rejected with 403 for SYSTEM roles (immutable).
 *     security: [{ BearerAuth: [] }]
 *     x-permission: roles:manage
 *     parameters: [{ $ref: '#/components/parameters/RoleIdParam' }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/UpdateRoleRequest' } } }
 *     responses:
 *       200: { description: Role updated. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks roles:manage, or the role is a SYSTEM role. }
 *       404: { description: No role with this ID exists in the tenant, or a permissionCodes entry does not exist. }
 *       422: { description: Validation failed. }
 *   delete:
 *     tags: [Roles]
 *     summary: Delete a role
 *     description: Soft-deletes the role. Rejected with 403 for SYSTEM roles (immutable).
 *     security: [{ BearerAuth: [] }]
 *     x-permission: roles:manage
 *     parameters: [{ $ref: '#/components/parameters/RoleIdParam' }]
 *     responses:
 *       200: { description: Role deleted. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks roles:manage, or the role is a SYSTEM role. }
 *       404: { description: No role with this ID exists in the tenant. }
 */
router.get(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(ROLE_PERMISSIONS.READ),
  validate({ params: roleIdParamSchema }),
  RoleController.getById,
);

/**
 * @swagger
 * /roles/{id}/users:
 *   get:
 *     tags: [Roles]
 *     summary: List users currently assigned this role
 *     description: Excludes expired assignments and soft-deleted users.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: roles:read
 *     parameters: [{ $ref: '#/components/parameters/RoleIdParam' }]
 *     responses:
 *       200: { description: Users holding this role. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `roles:read` permission. }
 *       404: { description: No role with this ID exists in the tenant. }
 */
router.get(
  '/:id/users',
  authMiddleware,
  tenantMiddleware,
  requirePermission(ROLE_PERMISSIONS.READ),
  validate({ params: roleIdParamSchema }),
  RoleController.getUsers,
);

router.patch(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(ROLE_PERMISSIONS.MANAGE),
  validate({ params: roleIdParamSchema, body: updateRoleSchema }),
  RoleController.update,
);

router.delete(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(ROLE_PERMISSIONS.MANAGE),
  validate({ params: roleIdParamSchema }),
  RoleController.delete,
);

export default router;
