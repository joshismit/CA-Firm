import { Router } from 'express';
import { ComplianceCategory } from '@prisma/client';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { validate } from '@middlewares/validation.middleware';
import { createComplianceFilingController } from '../controller/compliance-filing.controller';
import {
  createComplianceFilingSchema,
  updateComplianceFilingSchema,
  listComplianceFilingsQuerySchema,
  complianceFilingIdParamSchema,
} from '../schemas/compliance-filing.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Compliance Filing Routes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * A factory, not a fixed router — `app.ts` mounts this 4 times (once per
 * `ComplianceCategory`) at `/gst`, `/itr`, `/tds`, `/mca`, matching the
 * frontend's own sidebar route naming and `ComplianceModuleKey` exactly.
 * One generic module, four mount points — not four separate modules.
 *
 * Every route runs: authMiddleware → tenantMiddleware → validate →
 * controller. Deliberately has NO `requirePermission()` call — the audit
 * for this module found no compliance permission resource in either the
 * frontend's `PERMISSION_RESOURCES` registry or the backend's
 * `PermissionResource` enum, and the frontend's own
 * `ComplianceListPage.tsx` renders its mutating actions with no `<Can>`
 * gate for exactly that reason. Per explicit product decision, every route
 * here is reachable by any authenticated user in the tenant (auth + tenant
 * scoping only), matching that ungated frontend behavior rather than
 * inventing a permission resource.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function createComplianceFilingRoutes(category: ComplianceCategory): Router {
  const router = Router();
  const controller = createComplianceFilingController(category);

  /**
   * @swagger
   * components:
   *   schemas:
   *     ComplianceFilingStatus:
   *       type: string
   *       enum: [DRAFT, PENDING, FILED, OVERDUE]
   *     ComplianceFiling:
   *       type: object
   *       description: A generic filing tracker entry, shared by the /gst, /itr, /tds, and /mca route groups (this JSDoc block is written once and applies identically to all four mount points).
   *       properties:
   *         id: { type: string, format: uuid }
   *         reference: { type: string }
   *         period: { type: string, example: 'Q1 FY26' }
   *         status: { $ref: '#/components/schemas/ComplianceFilingStatus' }
   *         dueDate: { type: string, format: date-time, nullable: true }
   *         filedDate: { type: string, format: date-time, nullable: true }
   *         notes: { type: string, nullable: true }
   *         createdAt: { type: string, format: date-time }
   *         updatedAt: { type: string, format: date-time }
   *       required: [id, reference, period, status, createdAt, updatedAt]
   *     CreateComplianceFilingRequest:
   *       type: object
   *       required: [reference, period]
   *       properties:
   *         reference: { type: string, minLength: 2, maxLength: 100 }
   *         period: { type: string, minLength: 2, maxLength: 50 }
   *         dueDate: { type: string, format: date-time }
   *         notes: { type: string, maxLength: 2000 }
   *     UpdateComplianceFilingRequest:
   *       type: object
   *       description: Partial update.
   *       properties:
   *         reference: { type: string, minLength: 2, maxLength: 100 }
   *         period: { type: string, minLength: 2, maxLength: 50 }
   *         dueDate: { type: string, format: date-time }
   *         notes: { type: string, maxLength: 2000 }
   *   parameters:
   *     ComplianceFilingIdParam:
   *       name: id
   *       in: path
   *       required: true
   *       schema: { type: string, format: uuid }
   *       description: Filing ID.
   */

  /**
   * @swagger
   * /gst:
   *   get:
   *     tags: [Compliance]
   *     summary: List filings (also mounted at /itr, /tds, /mca)
   *     description: Paginated, filterable, searchable list of filings for this category, scoped to the current tenant. No permission gate — see this file's header comment for why.
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
   *         description: Case-insensitive match against reference or period.
   *         schema: { type: string, maxLength: 100 }
   *       - name: status
   *         in: query
   *         schema: { $ref: '#/components/schemas/ComplianceFilingStatus' }
   *     responses:
   *       200: { description: Paginated list of filings. }
   *       401: { description: Missing or invalid access token. }
   *       422: { description: Invalid query parameters. }
   *   post:
   *     tags: [Compliance]
   *     summary: Create a filing (also mounted at /itr, /tds, /mca)
   *     description: Created with status DRAFT — there is no status-transition endpoint (see this file's header comment).
   *     security: [{ BearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content: { application/json: { schema: { $ref: '#/components/schemas/CreateComplianceFilingRequest' } } }
   *     responses:
   *       201: { description: Filing created. }
   *       401: { description: Missing or invalid access token. }
   *       422: { description: Validation failed. }
   */

  router.get(
    '/',
    authMiddleware,
    tenantMiddleware,
    validate({ query: listComplianceFilingsQuerySchema }),
    controller.list,
  );

  router.post(
    '/',
    authMiddleware,
    tenantMiddleware,
    validate({ body: createComplianceFilingSchema }),
    controller.create,
  );

  /**
   * @swagger
   * /gst/{id}:
   *   get:
   *     tags: [Compliance]
   *     summary: Get a filing by ID (also mounted at /itr, /tds, /mca)
   *     security: [{ BearerAuth: [] }]
   *     parameters: [{ $ref: '#/components/parameters/ComplianceFilingIdParam' }]
   *     responses:
   *       200: { description: Filing found. }
   *       401: { description: Missing or invalid access token. }
   *       404: { description: No filing with this ID exists in this tenant/category. }
   *       422: { description: id is not a valid UUID. }
   *   patch:
   *     tags: [Compliance]
   *     summary: Update a filing (also mounted at /itr, /tds, /mca)
   *     security: [{ BearerAuth: [] }]
   *     parameters: [{ $ref: '#/components/parameters/ComplianceFilingIdParam' }]
   *     requestBody:
   *       required: true
   *       content: { application/json: { schema: { $ref: '#/components/schemas/UpdateComplianceFilingRequest' } } }
   *     responses:
   *       200: { description: Filing updated. }
   *       401: { description: Missing or invalid access token. }
   *       404: { description: No filing with this ID exists in this tenant/category. }
   *       422: { description: Validation failed. }
   *   delete:
   *     tags: [Compliance]
   *     summary: Delete a filing (also mounted at /itr, /tds, /mca)
   *     description: Soft-deletes the filing.
   *     security: [{ BearerAuth: [] }]
   *     parameters: [{ $ref: '#/components/parameters/ComplianceFilingIdParam' }]
   *     responses:
   *       200: { description: Filing deleted. }
   *       401: { description: Missing or invalid access token. }
   *       404: { description: No filing with this ID exists in this tenant/category. }
   */
  router.get(
    '/:id',
    authMiddleware,
    tenantMiddleware,
    validate({ params: complianceFilingIdParamSchema }),
    controller.getById,
  );

  router.patch(
    '/:id',
    authMiddleware,
    tenantMiddleware,
    validate({ params: complianceFilingIdParamSchema, body: updateComplianceFilingSchema }),
    controller.update,
  );

  router.delete(
    '/:id',
    authMiddleware,
    tenantMiddleware,
    validate({ params: complianceFilingIdParamSchema }),
    controller.delete,
  );

  return router;
}
