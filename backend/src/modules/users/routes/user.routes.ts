import { Router } from 'express';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { requirePermission } from '@middlewares/permission.middleware';
import { validate } from '@middlewares/validation.middleware';
import { UserController } from '../controller/user.controller';
import { USER_PERMISSIONS } from '../constants/user.permissions';
import {
  inviteUserSchema,
  updateUserSchema,
  listUsersQuerySchema,
  userIdParamSchema,
  invitationIdParamSchema,
} from '../schemas/user.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * User Routes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every route runs: authMiddleware → tenantMiddleware → requirePermission →
 * validate → controller. Mirrors `modules/contacts/routes/contact.routes.ts`.
 *
 * Static-segment routes (`/invite`, `/invitations/:id/...`) are registered
 * before `/:id` — Express matches routes in registration order, and `/:id`
 * would otherwise swallow `/invitations` as an `:id` value of `"invitations"`.
 *
 * Gating uses only `USER_PERMISSIONS.READ`/`MANAGE` — the frontend's
 * permission registry never defines granular `users:create`/`update`/
 * `delete` (see `constants/user.permissions.ts`), so every mutating route
 * here (invite/update/delete/resend/revoke) is gated on `MANAGE` and every
 * read route on `READ`, matching exactly what the frontend's `<Can>` guards
 * actually check.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     UserStatus:
 *       type: string
 *       enum: [ACTIVE, INACTIVE, INVITED, SUSPENDED, DELETED]
 *     User:
 *       type: object
 *       description: A tenant staff account, as returned by the API — never the raw database row (passwordHash/failedLoginCount/lockedUntil are never exposed).
 *       properties:
 *         id: { type: string, format: uuid }
 *         email: { type: string, format: email }
 *         firstName: { type: string }
 *         lastName: { type: string }
 *         phone: { type: string, nullable: true }
 *         status: { $ref: '#/components/schemas/UserStatus' }
 *         isOwner: { type: boolean }
 *         avatarStorageKey: { type: string, nullable: true }
 *         jobTitle: { type: string, nullable: true }
 *         lastLoginAt: { type: string, format: date-time, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *       required: [id, email, firstName, lastName, status, isOwner, createdAt]
 *     UserInvitation:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         email: { type: string, format: email }
 *         firstName: { type: string, nullable: true }
 *         lastName: { type: string, nullable: true }
 *         status: { type: string, enum: [PENDING, ACCEPTED, EXPIRED, REVOKED] }
 *         expiresAt: { type: string, format: date-time }
 *         createdAt: { type: string, format: date-time }
 *       required: [id, email, status, expiresAt, createdAt]
 *     InviteUserRequest:
 *       type: object
 *       required: [email, roleIds]
 *       properties:
 *         email: { type: string, format: email }
 *         firstName: { type: string, maxLength: 100 }
 *         lastName: { type: string, maxLength: 100 }
 *         roleIds: { type: array, items: { type: string, format: uuid }, minItems: 1 }
 *         message: { type: string, maxLength: 500 }
 *     UpdateUserRequest:
 *       type: object
 *       description: Partial update.
 *       properties:
 *         firstName: { type: string, minLength: 1, maxLength: 100 }
 *         lastName: { type: string, minLength: 1, maxLength: 100 }
 *         phone: { type: string, maxLength: 30 }
 *         jobTitle: { type: string, maxLength: 100 }
 *         status: { $ref: '#/components/schemas/UserStatus' }
 *   parameters:
 *     UserIdParam:
 *       name: id
 *       in: path
 *       required: true
 *       schema: { type: string, format: uuid }
 *       description: User ID.
 *     InvitationIdParam:
 *       name: id
 *       in: path
 *       required: true
 *       schema: { type: string, format: uuid }
 *       description: Invitation ID.
 */

// ─── Static-segment routes (must precede /:id) ───────────────────────────────

/**
 * @swagger
 * /users/invite:
 *   post:
 *     tags: [Users]
 *     summary: Invite a new staff user
 *     description: >
 *       Creates a pending `UserInvitation` and queues the notification email.
 *       Rejected with 409 if a user with this email already exists in the
 *       tenant, or another invitation is already pending for it. Rejected
 *       with 404 if any `roleIds` entry does not resolve to an active role
 *       in this tenant.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: users:manage
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/InviteUserRequest' } } }
 *     responses:
 *       201: { description: Invitation created., content: { application/json: { schema: { type: object, properties: { data: { $ref: '#/components/schemas/UserInvitation' } } } } } }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `users:manage` permission. }
 *       404: { description: One or more roleIds do not exist in this tenant. }
 *       409: { description: Email already in use, or an invitation is already pending. }
 *       422: { description: Validation failed. }
 */
router.post(
  '/invite',
  authMiddleware,
  tenantMiddleware,
  requirePermission(USER_PERMISSIONS.MANAGE),
  validate({ body: inviteUserSchema }),
  UserController.invite,
);

/**
 * @swagger
 * /users/invitations/{id}/resend:
 *   post:
 *     tags: [Users]
 *     summary: Resend a pending or expired invitation
 *     description: Reissues the invitation token and expiry, and re-queues the notification email.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: users:manage
 *     parameters: [{ $ref: '#/components/parameters/InvitationIdParam' }]
 *     responses:
 *       200: { description: Invitation resent. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `users:manage` permission. }
 *       404: { description: No invitation with this ID exists in the tenant. }
 *       409: { description: Invitation has already been accepted or revoked. }
 */
router.post(
  '/invitations/:id/resend',
  authMiddleware,
  tenantMiddleware,
  requirePermission(USER_PERMISSIONS.MANAGE),
  validate({ params: invitationIdParamSchema }),
  UserController.resendInvitation,
);

/**
 * @swagger
 * /users/invitations/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Revoke a pending invitation
 *     security: [{ BearerAuth: [] }]
 *     x-permission: users:manage
 *     parameters: [{ $ref: '#/components/parameters/InvitationIdParam' }]
 *     responses:
 *       200: { description: Invitation revoked. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `users:manage` permission. }
 *       404: { description: No invitation with this ID exists in the tenant. }
 *       409: { description: Invitation has already been accepted. }
 */
router.delete(
  '/invitations/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(USER_PERMISSIONS.MANAGE),
  validate({ params: invitationIdParamSchema }),
  UserController.revokeInvitation,
);

/**
 * @swagger
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: List users
 *     description: Paginated, filterable, searchable list of staff users scoped to the current tenant.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: users:read
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
 *         description: Case-insensitive match against first name, last name, or email.
 *         schema: { type: string, maxLength: 100 }
 *       - name: status
 *         in: query
 *         schema: { $ref: '#/components/schemas/UserStatus' }
 *     responses:
 *       200: { description: Paginated list of users. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `users:read` permission. }
 *       422: { description: Invalid query parameters. }
 */
router.get(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(USER_PERMISSIONS.READ),
  validate({ query: listUsersQuerySchema }),
  UserController.list,
);

// ─── /:id routes ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get a user by ID
 *     security: [{ BearerAuth: [] }]
 *     x-permission: users:read
 *     parameters: [{ $ref: '#/components/parameters/UserIdParam' }]
 *     responses:
 *       200: { description: User found. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `users:read` permission. }
 *       404: { description: No user with this ID exists in the tenant. }
 *       422: { description: id is not a valid UUID. }
 */
router.get(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(USER_PERMISSIONS.READ),
  validate({ params: userIdParamSchema }),
  UserController.getById,
);

/**
 * @swagger
 * /users/{id}/roles:
 *   get:
 *     tags: [Users]
 *     summary: List a user's assigned roles
 *     description: Returns every non-expired Role assignment for this user, each with its resolved permissionCodes.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: users:read
 *     parameters: [{ $ref: '#/components/parameters/UserIdParam' }]
 *     responses:
 *       200: { description: The user's assigned roles. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `users:read` permission. }
 *       404: { description: No user with this ID exists in the tenant. }
 */
router.get(
  '/:id/roles',
  authMiddleware,
  tenantMiddleware,
  requirePermission(USER_PERMISSIONS.READ),
  validate({ params: userIdParamSchema }),
  UserController.getRoles,
);

/**
 * @swagger
 * /users/{id}/sessions:
 *   get:
 *     tags: [Users]
 *     summary: List a user's active sessions
 *     description: Admin-facing counterpart of GET /auth/sessions (which is self-service, caller-only). isCurrent is always false — there is no session claim to compare against for an arbitrary other user.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: users:read
 *     parameters: [{ $ref: '#/components/parameters/UserIdParam' }]
 *     responses:
 *       200: { description: The user's active sessions. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `users:read` permission. }
 *       404: { description: No user with this ID exists in the tenant. }
 */
router.get(
  '/:id/sessions',
  authMiddleware,
  tenantMiddleware,
  requirePermission(USER_PERMISSIONS.READ),
  validate({ params: userIdParamSchema }),
  UserController.getSessions,
);

/**
 * @swagger
 * /users/{id}:
 *   patch:
 *     tags: [Users]
 *     summary: Update a user
 *     description: Rejected with 403 if attempting to change the account owner's status away from ACTIVE. Revokes all of the target user's active sessions/refresh tokens if status is changed away from ACTIVE.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: users:manage
 *     parameters: [{ $ref: '#/components/parameters/UserIdParam' }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/UpdateUserRequest' } } }
 *     responses:
 *       200: { description: User updated. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks users:manage, or attempted to change the owner's status. }
 *       404: { description: No user with this ID exists in the tenant. }
 *       422: { description: Validation failed. }
 */
router.patch(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(USER_PERMISSIONS.MANAGE),
  validate({ params: userIdParamSchema, body: updateUserSchema }),
  UserController.update,
);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Remove a user
 *     description: Soft-deletes the user (status becomes DELETED) and revokes all of their active sessions/refresh tokens. Rejected with 403 for the account owner or the caller's own account.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: users:manage
 *     parameters: [{ $ref: '#/components/parameters/UserIdParam' }]
 *     responses:
 *       200: { description: User removed. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks users:manage, or attempted to remove the owner or themselves. }
 *       404: { description: No user with this ID exists in the tenant. }
 */
router.delete(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(USER_PERMISSIONS.MANAGE),
  validate({ params: userIdParamSchema }),
  UserController.delete,
);

export default router;
