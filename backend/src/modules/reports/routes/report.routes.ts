import { Router } from 'express';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { requirePermission } from '@middlewares/permission.middleware';
import { validate } from '@middlewares/validation.middleware';
import { ReportController } from '../controller/report.controller';
import { REPORT_PERMISSIONS } from '../constants/report.permissions';
import { reportTypeParamSchema, reportFiltersQuerySchema, reportExportQuerySchema } from '../schemas/report.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Report Routes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every route runs: authMiddleware → tenantMiddleware → requirePermission →
 * validate → controller. Matches the frontend's own declared endpoints
 * exactly — `GET /reports/:type` (frontend/src/modules/reports/api/index.ts's
 * `generateReport`) and `GET /reports/:type/export` (`exportReport`) — both
 * GET, not POST; no saved reports, scheduled reports, background jobs,
 * report history, favorites, or templates exist or are implied.
 *
 * `READ` gates generation, `EXPORT` gates file export — reuses the
 * pre-existing `PermissionResource.REPORTS`/`PERMISSIONS.REPORTS_READ`/
 * `REPORTS_EXPORT` exactly (see `constants/report.permissions.ts`), matching
 * the frontend's own gating (`ReportDetailPage.tsx` wraps only its Export
 * buttons in `<Can permission={PERMISSIONS.REPORTS_EXPORT}>`).
 * ─────────────────────────────────────────────────────────────────────────────
 */
const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     ReportType:
 *       type: string
 *       enum: [NEW_LEADS, CONVERTED_CLIENTS, PENDING_TASKS, PENDING_DOCUMENTS, PAYMENTS_PENDING, DOCUMENT_ACTIVITY, STAFF_ASSIGNMENT_SUMMARY, MONTHLY_PENDING_WORK]
 *     ReportResult:
 *       type: object
 *       description: A generated report — `rows` shape varies by report type (column headers are the row objects' own keys, per the frontend's dynamic table rendering).
 *       properties:
 *         type: { $ref: '#/components/schemas/ReportType' }
 *         generatedAt: { type: string, format: date-time }
 *         rows: { type: array, items: { type: object } }
 *       required: [type, generatedAt, rows]
 *   parameters:
 *     ReportTypeParam:
 *       name: type
 *       in: path
 *       required: true
 *       schema: { $ref: '#/components/schemas/ReportType' }
 */

/**
 * @swagger
 * /reports/{type}:
 *   get:
 *     tags: [Reports]
 *     summary: Generate a report
 *     description: >
 *       Synchronous read-only projection over existing data — no report is
 *       persisted. Returns 501 for PENDING_DOCUMENTS (no document review/
 *       signature status exists in this backend).
 *     security: [{ BearerAuth: [] }]
 *     x-permission: reports:read
 *     parameters:
 *       - { $ref: '#/components/parameters/ReportTypeParam' }
 *       - name: from
 *         in: query
 *         schema: { type: string, format: date-time }
 *       - name: to
 *         in: query
 *         schema: { type: string, format: date-time }
 *       - name: staffId
 *         in: query
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Report generated. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `reports:read` permission. }
 *       422: { description: Invalid type or query parameters. }
 *       501: { description: This report type cannot be generated yet (e.g. PENDING_DOCUMENTS). }
 */
router.get(
  '/:type',
  authMiddleware,
  tenantMiddleware,
  requirePermission(REPORT_PERMISSIONS.READ),
  validate({ params: reportTypeParamSchema, query: reportFiltersQuerySchema }),
  ReportController.generate,
);

/**
 * @swagger
 * /reports/{type}/export:
 *   get:
 *     tags: [Reports]
 *     summary: Export a report as a file
 *     description: Only `format=CSV` is implemented — PDF/XLSX return 501 (no generation library exists in this backend).
 *     security: [{ BearerAuth: [] }]
 *     x-permission: reports:export
 *     parameters:
 *       - { $ref: '#/components/parameters/ReportTypeParam' }
 *       - name: from
 *         in: query
 *         schema: { type: string, format: date-time }
 *       - name: to
 *         in: query
 *         schema: { type: string, format: date-time }
 *       - name: staffId
 *         in: query
 *         schema: { type: string, format: uuid }
 *       - name: format
 *         in: query
 *         required: true
 *         schema: { type: string, enum: [CSV, PDF, XLSX] }
 *     responses:
 *       200: { description: File exported., content: { text/csv: { schema: { type: string, format: binary } } } }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `reports:export` permission. }
 *       422: { description: Invalid type or query parameters. }
 *       501: { description: This export format is not implemented (PDF/XLSX). }
 */
router.get(
  '/:type/export',
  authMiddleware,
  tenantMiddleware,
  requirePermission(REPORT_PERMISSIONS.EXPORT),
  validate({ params: reportTypeParamSchema, query: reportExportQuerySchema }),
  ReportController.export,
);

export default router;
