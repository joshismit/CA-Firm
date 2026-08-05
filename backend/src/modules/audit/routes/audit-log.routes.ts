import { Router } from 'express';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { requirePermission } from '@middlewares/permission.middleware';
import { validate } from '@middlewares/validation.middleware';
import { AuditLogController } from '../controller/audit-log.controller';
import { AUDIT_PERMISSIONS } from '../constants/audit.permissions';
import { listAuditLogsQuerySchema, auditLogIdParamSchema } from '../schemas/audit.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Audit Log Routes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every route runs: authMiddleware → tenantMiddleware → requirePermission →
 * validate → controller. Mirrors `modules/reports/routes/report.routes.ts`.
 * Read-only — no POST/PATCH/DELETE. Entries are written exclusively via
 * `AuditLogRecorder`, called from other modules' own services, never through
 * an HTTP endpoint of this module.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     AuditEventType:
 *       type: string
 *       enum: [UPLOAD, DOWNLOAD, SHARE, LOGIN, LOGOUT, ROLE_CHANGE, TASK_UPDATE, PAYMENT_ACTION, PERMISSION_CHANGE, PASSWORD_RESET, INVITATION_ACCEPTED, TASK_REMINDER_SENT]
 *     AuditLog:
 *       type: object
 *       description: A security-relevant activity record, as returned by the API — never the raw database row.
 *       properties:
 *         id: { type: string, format: uuid }
 *         eventType: { $ref: '#/components/schemas/AuditEventType' }
 *         actorId: { type: string, format: uuid }
 *         actorName: { type: string }
 *         targetType: { type: string, nullable: true }
 *         targetId: { type: string, format: uuid, nullable: true }
 *         description: { type: string }
 *         ipAddress: { type: string, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *       required: [id, eventType, actorId, actorName, description, createdAt]
 *   parameters:
 *     AuditLogIdParam:
 *       name: id
 *       in: path
 *       required: true
 *       schema: { type: string, format: uuid }
 *       description: Audit log entry ID.
 */

/**
 * @swagger
 * /audit-logs:
 *   get:
 *     tags: [Audit Logs]
 *     summary: List audit log entries
 *     description: Paginated, filterable, searchable list of security-relevant activity, scoped to the current tenant.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: audit_logs:read
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
 *         description: Case-insensitive match against description.
 *         schema: { type: string, maxLength: 100 }
 *       - name: eventType
 *         in: query
 *         schema: { $ref: '#/components/schemas/AuditEventType' }
 *       - name: actorId
 *         in: query
 *         schema: { type: string, format: uuid }
 *       - name: targetType
 *         in: query
 *         schema: { type: string }
 *       - name: from
 *         in: query
 *         schema: { type: string, format: date }
 *       - name: to
 *         in: query
 *         schema: { type: string, format: date }
 *     responses:
 *       200: { description: Paginated list of audit log entries. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `audit_logs:read` permission. }
 *       422: { description: Invalid query parameters. }
 */
router.get(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(AUDIT_PERMISSIONS.READ),
  validate({ query: listAuditLogsQuerySchema }),
  AuditLogController.list,
);

/**
 * @swagger
 * /audit-logs/{id}:
 *   get:
 *     tags: [Audit Logs]
 *     summary: Get an audit log entry by ID
 *     security: [{ BearerAuth: [] }]
 *     x-permission: audit_logs:read
 *     parameters: [{ $ref: '#/components/parameters/AuditLogIdParam' }]
 *     responses:
 *       200: { description: Audit log entry found. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `audit_logs:read` permission. }
 *       404: { description: No audit log entry with this ID exists in the tenant. }
 *       422: { description: id is not a valid UUID. }
 */
router.get(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(AUDIT_PERMISSIONS.READ),
  validate({ params: auditLogIdParamSchema }),
  AuditLogController.getById,
);

export default router;
