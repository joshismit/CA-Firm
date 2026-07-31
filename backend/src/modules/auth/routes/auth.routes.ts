import { Router } from 'express';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { validate } from '@middlewares/validation.middleware';
import { authRateLimiter } from '@middlewares/rate-limit.middleware';
import { AuthController } from '../controller/auth.controller';
import {
  loginSchema,
  refreshTokenSchema,
  logoutSchema,
  revokeAllSessionsSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  inviteTokenParamSchema,
  acceptInviteSchema,
} from '../schemas/auth.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Auth Routes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `/login`, `/refresh`, `/forgot-password`, `/reset-password`,
 * `/invite/:token`, and `/invite/:token/accept` are the only public (no
 * `authMiddleware`) routes in this entire application — by definition,
 * nothing else can require a JWT that doesn't exist yet (a password-reset or
 * invite-accept caller has no session to authenticate with). Every other
 * route runs the same authMiddleware → tenantMiddleware → validate →
 * controller chain as every other module (no `requirePermission()` anywhere
 * here — these are self-service actions on the caller's own account/
 * sessions, not resource-permission-gated operations).
 *
 * Every public route also runs `authRateLimiter` — the same credential-
 * stuffing/brute-force defense `/login` and `/refresh` already use, since
 * these all accept either a guessable identifier (an email) or a
 * high-entropy token whose validity an attacker could otherwise probe
 * unthrottled.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     LoginRequest:
 *       type: object
 *       required: [email, password]
 *       properties:
 *         email: { type: string, format: email }
 *         password: { type: string }
 *         rememberMe: { type: boolean }
 *     AuthUser:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         email: { type: string }
 *         role: { type: string }
 *         tenantId: { type: string, format: uuid }
 *         permissions: { type: array, items: { type: string } }
 *         firstName: { type: string }
 *         lastName: { type: string }
 *     LoginResponse:
 *       type: object
 *       properties:
 *         accessToken: { type: string }
 *         refreshToken: { type: string }
 *         user: { $ref: '#/components/schemas/AuthUser' }
 *         tenant: { type: object }
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in with email and password
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/LoginRequest' } } }
 *     responses:
 *       200: { description: Logged in., content: { application/json: { schema: { type: object, properties: { data: { $ref: '#/components/schemas/LoginResponse' } } } } } }
 *       401: { description: Invalid email or password., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Account locked/inactive, or tenant inactive., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.post('/login', authRateLimiter, validate({ body: loginSchema }), AuthController.login);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Rotate a refresh token for a new access/refresh token pair
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, required: [refreshToken], properties: { refreshToken: { type: string } } } } }
 *     responses:
 *       200: { description: Token refreshed., content: { application/json: { schema: { type: object } } } }
 *       401: { description: Invalid, expired, revoked, or reused refresh token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.post('/refresh', authRateLimiter, validate({ body: refreshTokenSchema }), AuthController.refresh);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request a password reset link
 *     description: >
 *       Always responds 200 with the same generic message whether or not the
 *       email matches an active account — prevents user enumeration. A real
 *       reset link is only ever emailed for a genuine, ACTIVE user.
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, required: [email], properties: { email: { type: string, format: email } } } } }
 *     responses:
 *       200: { description: If an account exists for this email, a reset link has been sent., content: { application/json: { schema: { type: object } } } }
 *       422: { description: Validation failed., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       429: { description: Too many requests., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.post('/forgot-password', authRateLimiter, validate({ body: forgotPasswordSchema }), AuthController.forgotPassword);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset a password using a token from the forgot-password email
 *     description: >
 *       One-time use — the token is rejected on a second attempt, once
 *       expired (`TOKEN.PASSWORD_RESET_EXPIRY_MINUTES`), or once superseded
 *       by a newer forgot-password request. On success, every active session
 *       and refresh token for the account is revoked.
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, required: [token, newPassword], properties: { token: { type: string }, newPassword: { type: string } } } } }
 *     responses:
 *       200: { description: Password reset., content: { application/json: { schema: { type: object } } } }
 *       401: { description: The reset token is invalid, already used, or has expired., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       429: { description: Too many requests., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.post('/reset-password', authRateLimiter, validate({ body: resetPasswordSchema }), AuthController.resetPassword);

/**
 * @swagger
 * /auth/invite/{token}:
 *   get:
 *     tags: [Auth]
 *     summary: Preview an invitation before accepting it
 *     description: Who invited the recipient, and to which firm/role — shown before the accept-invite form.
 *     parameters:
 *       - name: token
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Invitation details., content: { application/json: { schema: { type: object } } } }
 *       404: { description: No PENDING invitation matches this token (unknown, already accepted, revoked, or expired)., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       429: { description: Too many requests., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.get('/invite/:token', authRateLimiter, validate({ params: inviteTokenParamSchema }), AuthController.getInviteInfo);

/**
 * @swagger
 * /auth/invite/{token}/accept:
 *   post:
 *     tags: [Auth]
 *     summary: Accept an invitation and activate the account
 *     description: >
 *       Creates the `User` row (an invited person has none until this call),
 *       assigns every role the invitation carried, and marks the invitation
 *       ACCEPTED — all inside one transaction. Rejected identically for an
 *       unknown, already-accepted, revoked, or expired token.
 *     parameters:
 *       - name: token
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, required: [fullName, password], properties: { fullName: { type: string }, password: { type: string } } } } }
 *     responses:
 *       200: { description: Invitation accepted., content: { application/json: { schema: { type: object } } } }
 *       401: { description: The invitation is invalid, already accepted, revoked, or has expired., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       409: { description: A user with this email already exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       429: { description: Too many requests., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.post(
  '/invite/:token/accept',
  authRateLimiter,
  validate({ params: inviteTokenParamSchema, body: acceptInviteSchema }),
  AuthController.acceptInvite,
);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Log out the session identified by the given refresh token
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, required: [refreshToken], properties: { refreshToken: { type: string } } } } }
 *     responses:
 *       200: { description: Logged out., content: { application/json: { schema: { type: object } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.post('/logout', authMiddleware, tenantMiddleware, validate({ body: logoutSchema }), AuthController.logout);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get the authenticated user's own profile
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Current user profile., content: { application/json: { schema: { type: object } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.get('/me', authMiddleware, tenantMiddleware, AuthController.me);

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     tags: [Auth]
 *     summary: Change the authenticated user's own password
 *     description: Revokes every other active session as a side effect.
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, required: [currentPassword, newPassword], properties: { currentPassword: { type: string }, newPassword: { type: string } } } } }
 *     responses:
 *       200: { description: Password changed., content: { application/json: { schema: { type: object } } } }
 *       401: { description: Missing/invalid access token, or current password incorrect., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       409: { description: New password matches one of the last N passwords., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.post('/change-password', authMiddleware, tenantMiddleware, validate({ body: changePasswordSchema }), AuthController.changePassword);

/**
 * @swagger
 * /auth/sessions:
 *   get:
 *     tags: [Auth]
 *     summary: List the authenticated user's own active sessions
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Active sessions., content: { application/json: { schema: { type: object } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.get('/sessions', authMiddleware, tenantMiddleware, AuthController.listSessions);

/**
 * @swagger
 * /auth/sessions/revoke-all:
 *   post:
 *     tags: [Auth]
 *     summary: Log out of every other session (optionally except the caller's own)
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: false
 *       content: { application/json: { schema: { type: object, properties: { refreshToken: { type: string } } } } }
 *     responses:
 *       200: { description: Sessions revoked., content: { application/json: { schema: { type: object } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.post(
  '/sessions/revoke-all',
  authMiddleware,
  tenantMiddleware,
  validate({ body: revokeAllSessionsSchema }),
  AuthController.revokeAllSessions,
);

/**
 * @swagger
 * /auth/sessions/{id}:
 *   delete:
 *     tags: [Auth]
 *     summary: Revoke one specific session (e.g. "log out this device")
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Session revoked., content: { application/json: { schema: { type: object } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No such session for this user., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.delete('/sessions/:id', authMiddleware, tenantMiddleware, AuthController.revokeSession);

export default router;
