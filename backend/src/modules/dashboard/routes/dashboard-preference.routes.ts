import { Router } from 'express';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { validate } from '@middlewares/validation.middleware';
import { DashboardPreferenceController } from '../controller/dashboard-preference.controller';
import { updateDashboardPreferencesSchema } from '../schemas/dashboard-preference.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Dashboard Preference Routes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every route runs: authMiddleware → tenantMiddleware → validate →
 * controller. Deliberately has NO `requirePermission()` call anywhere — this
 * is a self-service personal dashboard layout (a user's own widget show/hide
 * + order), matching how `modules/notifications/routes/notification.routes
 * .ts` (a user's own inbox) and auth's own change-password/sessions actions
 * aren't permission-gated either. Widget-level access control (hiding a
 * widget for a module the caller can't read) is enforced by the frontend
 * against its own registry, same as `QuickActionsWidget.tsx` already gates
 * each of its buttons with `<Can>` — there is no backend "dashboard" module
 * with its own aggregate endpoints to gate here (see
 * `modules/dashboard/index.ts`'s header comment); this table only ever
 * stores an opaque ordering/visibility preference the frontend interprets.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     WidgetPreference:
 *       type: object
 *       properties:
 *         widgetId: { type: string, maxLength: 60, description: "Opaque widget identifier owned by the frontend's widget registry." }
 *         visible: { type: boolean }
 *       required: [widgetId, visible]
 *     DashboardPreference:
 *       type: object
 *       properties:
 *         widgets:
 *           type: array
 *           description: Ordered layout — array index is display order. Empty for a user who has never customized their dashboard (defaults apply client-side).
 *           items: { $ref: '#/components/schemas/WidgetPreference' }
 *         updatedAt: { type: string, format: date-time, nullable: true }
 *       required: [widgets, updatedAt]
 *     UpdateDashboardPreferencesRequest:
 *       type: object
 *       properties:
 *         widgets:
 *           type: array
 *           maxItems: 50
 *           items: { $ref: '#/components/schemas/WidgetPreference' }
 *       required: [widgets]
 */

/**
 * @swagger
 * /dashboard/preferences:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get the caller's dashboard widget preferences
 *     description: Returns an empty widgets array if this user has never customized their dashboard — not a 404.
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: The caller's dashboard preferences., content: { application/json: { schema: { type: object, properties: { data: { $ref: '#/components/schemas/DashboardPreference' } } } } } }
 *       401: { description: Missing or invalid access token. }
 *   patch:
 *     tags: [Dashboard]
 *     summary: Replace the caller's dashboard widget preferences
 *     description: Full replacement of the widget layout (show/hide + order). Creates the row on first write.
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/UpdateDashboardPreferencesRequest' } } }
 *     responses:
 *       200: { description: Preferences updated. }
 *       401: { description: Missing or invalid access token. }
 *       422: { description: Validation failed. }
 */
router.get('/', authMiddleware, tenantMiddleware, DashboardPreferenceController.get);

router.patch(
  '/',
  authMiddleware,
  tenantMiddleware,
  validate({ body: updateDashboardPreferencesSchema }),
  DashboardPreferenceController.update,
);

/**
 * @swagger
 * /dashboard/preferences/reset:
 *   post:
 *     tags: [Dashboard]
 *     summary: Restore the caller's dashboard to its default layout
 *     description: Deletes the caller's personal layout row. The next GET falls back to their tenant's configured role default, or the registry default if none exists.
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Preferences reset. }
 *       401: { description: Missing or invalid access token. }
 */
router.post('/reset', authMiddleware, tenantMiddleware, DashboardPreferenceController.reset);

export default router;
