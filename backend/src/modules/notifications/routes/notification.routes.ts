import { Router } from 'express';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { validate } from '@middlewares/validation.middleware';
import { NotificationController } from '../controller/notification.controller';
import { listNotificationsQuerySchema, notificationIdParamSchema } from '../schemas/notification.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Notification Routes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every route runs: authMiddleware → tenantMiddleware → validate →
 * controller. Deliberately has NO `requirePermission()` call anywhere —
 * this is a self-service personal inbox (a user's own notifications), and
 * the frontend's own `NotificationListPage.tsx` explicitly does not wrap
 * mark-as-read/delete in `<Can>`, "matches how auth's own change-password/
 * sessions actions aren't permission-gated either." `PermissionResource
 * .NOTIFICATIONS`/`PERMISSIONS.NOTIFICATIONS_READ`/`MANAGE` already exist in
 * both registries but are used elsewhere, not by this module — never
 * invented, never applied where the frontend doesn't apply them.
 *
 * Ownership (not just tenant membership) is enforced entirely in
 * `NotificationService`/`NotificationRepository` — every query is scoped to
 * `req.user.id`, so this middleware chain alone would not be sufficient;
 * see those files' header comments.
 *
 * `/read-all` (POST) is registered before `/:id` — Express matches routes
 * in registration order, and `/:id` would otherwise swallow `/read-all` as
 * an `:id` value of `"read-all"`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     NotificationChannel:
 *       type: string
 *       enum: [WHATSAPP, EMAIL, SMS, IN_APP]
 *     NotificationDeliveryStatus:
 *       type: string
 *       enum: [PENDING, SENT, DELIVERED, FAILED]
 *     Notification:
 *       type: object
 *       description: A notification belonging to the authenticated user, as returned by the API — never the raw database row.
 *       properties:
 *         id: { type: string, format: uuid }
 *         channel: { $ref: '#/components/schemas/NotificationChannel' }
 *         status: { $ref: '#/components/schemas/NotificationDeliveryStatus' }
 *         title: { type: string }
 *         message: { type: string }
 *         isRead: { type: boolean }
 *         createdAt: { type: string, format: date-time }
 *       required: [id, channel, status, title, message, isRead, createdAt]
 *   parameters:
 *     NotificationIdParam:
 *       name: id
 *       in: path
 *       required: true
 *       schema: { type: string, format: uuid }
 *       description: Notification ID.
 */

/**
 * @swagger
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: List the authenticated user's notifications
 *     description: Paginated, filterable, searchable list — always scoped to the caller's own notifications, never another user's.
 *     security: [{ BearerAuth: [] }]
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
 *         description: Case-insensitive match against title or message.
 *         schema: { type: string, maxLength: 100 }
 *       - name: channel
 *         in: query
 *         schema: { $ref: '#/components/schemas/NotificationChannel' }
 *       - name: status
 *         in: query
 *         schema: { $ref: '#/components/schemas/NotificationDeliveryStatus' }
 *       - name: unreadOnly
 *         in: query
 *         schema: { type: boolean }
 *     responses:
 *       200: { description: Paginated list of the caller's notifications. }
 *       401: { description: Missing or invalid access token. }
 *       422: { description: Invalid query parameters. }
 */
router.get(
  '/',
  authMiddleware,
  tenantMiddleware,
  validate({ query: listNotificationsQuerySchema }),
  NotificationController.list,
);

/**
 * @swagger
 * /notifications/read-all:
 *   post:
 *     tags: [Notifications]
 *     summary: Mark all of the authenticated user's notifications as read
 *     description: Affects only the caller's own notifications — never another user's, even within the same tenant.
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: All of the caller's unread notifications marked as read. }
 *       401: { description: Missing or invalid access token. }
 */
router.post('/read-all', authMiddleware, tenantMiddleware, NotificationController.markAllAsRead);

/**
 * @swagger
 * /notifications/{id}:
 *   get:
 *     tags: [Notifications]
 *     summary: Get a notification by ID
 *     security: [{ BearerAuth: [] }]
 *     parameters: [{ $ref: '#/components/parameters/NotificationIdParam' }]
 *     responses:
 *       200: { description: Notification found. }
 *       401: { description: Missing or invalid access token. }
 *       404: { description: No notification with this ID exists for the caller. }
 *       422: { description: id is not a valid UUID. }
 *   delete:
 *     tags: [Notifications]
 *     summary: Delete a notification
 *     description: Soft-deletes the notification. Only the owner may delete it.
 *     security: [{ BearerAuth: [] }]
 *     parameters: [{ $ref: '#/components/parameters/NotificationIdParam' }]
 *     responses:
 *       200: { description: Notification deleted. }
 *       401: { description: Missing or invalid access token. }
 *       404: { description: No notification with this ID exists for the caller. }
 */
router.get(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  validate({ params: notificationIdParamSchema }),
  NotificationController.getById,
);

router.delete(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  validate({ params: notificationIdParamSchema }),
  NotificationController.delete,
);

/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark a notification as read
 *     description: Idempotent — marking an already-read notification succeeds without effect. Only the owner may mark it.
 *     security: [{ BearerAuth: [] }]
 *     parameters: [{ $ref: '#/components/parameters/NotificationIdParam' }]
 *     responses:
 *       200: { description: Notification marked as read. }
 *       401: { description: Missing or invalid access token. }
 *       404: { description: No notification with this ID exists for the caller. }
 */
router.patch(
  '/:id/read',
  authMiddleware,
  tenantMiddleware,
  validate({ params: notificationIdParamSchema }),
  NotificationController.markAsRead,
);

export default router;
