import { Router } from 'express';
import { UserRole } from '@shared/enums';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { requireRole } from '@middlewares/permission.middleware';
import { validate } from '@middlewares/validation.middleware';
import { CalendarController } from '../controller/calendar.controller';
import {
  calendarQuerySchema,
  createCalendarEventSchema,
  updateCalendarEventSchema,
  calendarEventIdParamSchema,
} from '../schemas/calendar.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Work Calendar Routes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every route: `authMiddleware → tenantMiddleware → requireRole(TENANT_ADMIN,
 * MANAGER, STAFF) → validate → controller` — the exact same gate
 * `/dashboard/calendar` already uses (`requireRole`, not `requirePermission`;
 * see `dashboard.routes.ts`'s own header comment for why). No new
 * `PermissionResource` was added for this module, for the identical reason.
 * `CalendarAggregationService`/`CalendarEventService` enforce the actual "my
 * work vs firm work" / ownership scoping (PRD §11) — this gate only excludes
 * `CLIENT` (no client-portal calendar exists) and unauthenticated/
 * cross-tenant callers.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const router = Router();

const requireCalendarRole = requireRole(UserRole.TENANT_ADMIN, UserRole.MANAGER, UserRole.STAFF);

/**
 * @swagger
 * /calendar:
 *   get:
 *     tags: [Calendar]
 *     summary: Work Calendar — normalized Task + CalendarEvent feed for a date range
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: from
 *         required: true
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         required: true
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: scope
 *         schema: { type: string, enum: [mine, firm], default: mine }
 *       - in: query
 *         name: businessId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: staffId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: eventType
 *         schema: { type: string }
 *       - in: query
 *         name: source
 *         schema: { type: string, enum: [TASK, EVENT] }
 *     responses:
 *       200: { description: Normalized calendar items in range, sorted by date. }
 *       403: { description: scope=firm requested by a non-tenant-wide role. }
 */
router.get(
  '/',
  authMiddleware,
  tenantMiddleware,
  requireCalendarRole,
  validate({ query: calendarQuerySchema }),
  CalendarController.list,
);

router.post(
  '/events',
  authMiddleware,
  tenantMiddleware,
  requireCalendarRole,
  validate({ body: createCalendarEventSchema }),
  CalendarController.createEvent,
);

router.get(
  '/events/:id',
  authMiddleware,
  tenantMiddleware,
  requireCalendarRole,
  validate({ params: calendarEventIdParamSchema }),
  CalendarController.getEvent,
);

router.patch(
  '/events/:id',
  authMiddleware,
  tenantMiddleware,
  requireCalendarRole,
  validate({ params: calendarEventIdParamSchema, body: updateCalendarEventSchema }),
  CalendarController.updateEvent,
);

router.delete(
  '/events/:id',
  authMiddleware,
  tenantMiddleware,
  requireCalendarRole,
  validate({ params: calendarEventIdParamSchema }),
  CalendarController.deleteEvent,
);

export default router;
