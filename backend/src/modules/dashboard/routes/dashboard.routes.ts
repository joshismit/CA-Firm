import { Router } from 'express';
import { UserRole } from '@shared/enums';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { requireRole } from '@middlewares/permission.middleware';
import { validate } from '@middlewares/validation.middleware';
import { DashboardController } from '../controller/dashboard.controller';
import {
  getDashboardWidgetDataQuerySchema,
  getDashboardCalendarQuerySchema,
  getDashboardActivityQuerySchema,
  getDashboardPerformanceQuerySchema,
} from '../schemas/dashboard.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Dashboard Aggregation Routes (PRD §10.10)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every route: `authMiddleware → tenantMiddleware → requireRole(TENANT_ADMIN,
 * MANAGER, STAFF) → validate → controller`. `requireRole` (not
 * `requirePermission`) deliberately — every dashboard consumer already holds
 * whatever underlying module permission is required to see the data a widget
 * surfaces (`DashboardAggregationService` itself enforces the "my X only"
 * scoping, PRD §10.11); this gate only needs to exclude `CLIENT` (no client
 * portal dashboard exists) and unauthenticated/cross-tenant callers, not
 * reproduce per-widget permission logic. No new `PermissionResource` was
 * added for this — see the PRD §10 implementation plan for why.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const router = Router();

const requireDashboardRole = requireRole(UserRole.TENANT_ADMIN, UserRole.MANAGER, UserRole.STAFF);

/**
 * @swagger
 * /dashboard:
 *   get:
 *     tags: [Dashboard]
 *     summary: Compact counts-only dashboard overview
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Dashboard overview counts. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller's role cannot view the dashboard. }
 */
router.get('/', authMiddleware, tenantMiddleware, requireDashboardRole, DashboardController.getOverview);

/**
 * @swagger
 * /dashboard/widgets:
 *   get:
 *     tags: [Dashboard]
 *     summary: List-shaped data for one or more dashboard widgets
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: ids
 *         required: true
 *         schema: { type: string }
 *         description: Comma-separated widget ids (pending-works, due-dates, payment-reminders, compliance-deadlines, assigned-clients, outstanding-payments).
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 5, maximum: 20 }
 *     responses:
 *       200: { description: Requested widgets' data, keyed by id. }
 *       422: { description: Unknown widget id. }
 */
router.get(
  '/widgets',
  authMiddleware,
  tenantMiddleware,
  requireDashboardRole,
  validate({ query: getDashboardWidgetDataQuerySchema }),
  DashboardController.getWidgetData,
);

/**
 * @swagger
 * /dashboard/calendar:
 *   get:
 *     tags: [Dashboard]
 *     summary: Unified calendar feed (task due dates + compliance deadlines + invoice due dates)
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200: { description: Calendar entries in range, sorted by date. }
 */
router.get(
  '/calendar',
  authMiddleware,
  tenantMiddleware,
  requireDashboardRole,
  validate({ query: getDashboardCalendarQuerySchema }),
  DashboardController.getCalendar,
);

/**
 * @swagger
 * /dashboard/activity:
 *   get:
 *     tags: [Dashboard]
 *     summary: Recent activity feed, sourced from AuditLog
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 50 }
 *     responses:
 *       200: { description: Recent audit log entries. }
 */
router.get(
  '/activity',
  authMiddleware,
  tenantMiddleware,
  requireDashboardRole,
  validate({ query: getDashboardActivityQuerySchema }),
  DashboardController.getActivity,
);

/**
 * @swagger
 * /dashboard/performance:
 *   get:
 *     tags: [Dashboard]
 *     summary: Performance rollup (completed/pending/overdue tasks, documents uploaded, pending payments)
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200: { description: Performance summary for the requested range. staffBreakdown is null for STAFF callers. }
 */
router.get(
  '/performance',
  authMiddleware,
  tenantMiddleware,
  requireDashboardRole,
  validate({ query: getDashboardPerformanceQuerySchema }),
  DashboardController.getPerformance,
);

export default router;
