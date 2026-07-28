import { Router } from 'express';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { requirePermission } from '@middlewares/permission.middleware';
import { validate } from '@middlewares/validation.middleware';
import { LeadController } from '../controller/lead.controller';
import { CRM_PERMISSIONS } from '../constants/lead.permissions';
import {
  createLeadSchema,
  updateLeadSchema,
  listLeadsQuerySchema,
  leadIdParamSchema,
  convertLeadSchema,
} from '../schemas/lead.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CRM (Lead) Routes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every route runs: authMiddleware → tenantMiddleware → requirePermission →
 * validate → controller. Mirrors `modules/business/routes/business.routes.ts`.
 *
 * `/stages` is a static-segment route and must precede `/:id` — Express
 * matches routes in registration order, and `/:id` would otherwise swallow
 * it. `/:id/convert` is registered after the plain `/:id` routes since it
 * has an extra segment and can't be ambiguous with them.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Lead:
 *       type: object
 *       description: A lead response as returned by the API — never the raw database row.
 *       properties:
 *         id: { type: string, format: uuid }
 *         businessId: { type: string, format: uuid, nullable: true }
 *         contactId: { type: string, format: uuid, nullable: true }
 *         title: { type: string, example: Acme Corp — GST Advisory }
 *         sourceId: { type: string, format: uuid }
 *         stageId: { type: string, format: uuid }
 *         expectedRevenue: { type: number, nullable: true }
 *         probability: { type: integer, nullable: true, minimum: 0, maximum: 100 }
 *         expectedCloseDate: { type: string, format: date-time, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *       required: [id, title, sourceId, stageId, createdAt, updatedAt]
 *     LeadStage:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         name: { type: string, example: Proposal }
 *         order: { type: integer }
 *       required: [id, name, order]
 *     CreateLeadRequest:
 *       type: object
 *       required: [title, sourceId, stageId]
 *       properties:
 *         businessId: { type: string, format: uuid }
 *         contactId: { type: string, format: uuid }
 *         title: { type: string, minLength: 2, maxLength: 255 }
 *         sourceId: { type: string, format: uuid }
 *         stageId: { type: string, format: uuid }
 *         expectedRevenue: { type: number, minimum: 0 }
 *         probability: { type: integer, minimum: 0, maximum: 100 }
 *         expectedCloseDate: { type: string, format: date-time }
 *     UpdateLeadRequest:
 *       type: object
 *       description: Partial update.
 *       properties:
 *         businessId: { type: string, format: uuid, nullable: true }
 *         contactId: { type: string, format: uuid, nullable: true }
 *         title: { type: string, minLength: 2, maxLength: 255 }
 *         sourceId: { type: string, format: uuid }
 *         stageId: { type: string, format: uuid }
 *         expectedRevenue: { type: number, minimum: 0, nullable: true }
 *         probability: { type: integer, minimum: 0, maximum: 100, nullable: true }
 *         expectedCloseDate: { type: string, format: date-time, nullable: true }
 *     ConvertLeadRequest:
 *       type: object
 *       properties:
 *         notes: { type: string, maxLength: 1000 }
 *     LeadEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Success }
 *         data: { $ref: '#/components/schemas/Lead' }
 *         timestamp: { type: string, format: date-time }
 *         correlationId: { type: string, format: uuid }
 *         durationMs: { type: number }
 *     LeadListEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Fetched successfully }
 *         data: { type: array, items: { $ref: '#/components/schemas/Lead' } }
 *         meta: { $ref: '#/components/schemas/PaginationMeta' }
 *         timestamp: { type: string, format: date-time }
 *         correlationId: { type: string, format: uuid }
 *     LeadStageListEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Fetched successfully }
 *         data: { type: array, items: { $ref: '#/components/schemas/LeadStage' } }
 *         timestamp: { type: string, format: date-time }
 *         correlationId: { type: string, format: uuid }
 *   parameters:
 *     LeadIdParam:
 *       name: id
 *       in: path
 *       required: true
 *       schema: { type: string, format: uuid }
 *       description: Lead ID.
 */

// ─── Static-segment routes (must precede /:id) ───────────────────────────────

/**
 * @swagger
 * /crm:
 *   post:
 *     tags: [CRM]
 *     summary: Create a lead
 *     security: [{ BearerAuth: [] }]
 *     x-permission: crm:create
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/CreateLeadRequest' } } }
 *     responses:
 *       201: { description: Lead created., content: { application/json: { schema: { $ref: '#/components/schemas/LeadEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `crm:create` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       409: { description: Referenced businessId/contactId/sourceId/stageId does not exist (foreign key violation)., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.post(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CRM_PERMISSIONS.CREATE),
  validate({ body: createLeadSchema }),
  LeadController.create,
);

/**
 * @swagger
 * /crm:
 *   get:
 *     tags: [CRM]
 *     summary: List leads
 *     description: Paginated, filterable, searchable list of leads scoped to the current tenant.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: crm:read
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
 *         description: Case-insensitive match against title.
 *         schema: { type: string, maxLength: 100 }
 *       - name: stageId
 *         in: query
 *         schema: { type: string, format: uuid }
 *       - name: sourceId
 *         in: query
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Paginated list of leads., content: { application/json: { schema: { $ref: '#/components/schemas/LeadListEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `crm:read` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Invalid query parameters., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.get(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CRM_PERMISSIONS.READ),
  validate({ query: listLeadsQuerySchema }),
  LeadController.list,
);

/**
 * @swagger
 * /crm/stages:
 *   get:
 *     tags: [CRM]
 *     summary: List lead stages
 *     description: Returns the tenant's LeadStage catalog, ordered by `order` ascending. Used to populate the Stage picker/filter.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: crm:read
 *     responses:
 *       200: { description: Lead stages., content: { application/json: { schema: { $ref: '#/components/schemas/LeadStageListEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `crm:read` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.get(
  '/stages',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CRM_PERMISSIONS.READ),
  LeadController.listStages,
);

// ─── /:id routes ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /crm/{id}:
 *   get:
 *     tags: [CRM]
 *     summary: Get a lead by ID
 *     security: [{ BearerAuth: [] }]
 *     x-permission: crm:read
 *     parameters: [{ $ref: '#/components/parameters/LeadIdParam' }]
 *     responses:
 *       200: { description: Lead found., content: { application/json: { schema: { $ref: '#/components/schemas/LeadEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `crm:read` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No lead with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: id is not a valid UUID., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.get(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CRM_PERMISSIONS.READ),
  validate({ params: leadIdParamSchema }),
  LeadController.getById,
);

/**
 * @swagger
 * /crm/{id}:
 *   patch:
 *     tags: [CRM]
 *     summary: Update a lead
 *     security: [{ BearerAuth: [] }]
 *     x-permission: crm:update
 *     parameters: [{ $ref: '#/components/parameters/LeadIdParam' }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/UpdateLeadRequest' } } }
 *     responses:
 *       200: { description: Lead updated., content: { application/json: { schema: { $ref: '#/components/schemas/LeadEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `crm:update` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No lead with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       409: { description: Referenced businessId/contactId/sourceId/stageId does not exist (foreign key violation)., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.patch(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CRM_PERMISSIONS.UPDATE),
  validate({ params: leadIdParamSchema, body: updateLeadSchema }),
  LeadController.update,
);

/**
 * @swagger
 * /crm/{id}:
 *   delete:
 *     tags: [CRM]
 *     summary: Soft-delete a lead
 *     description: Soft-deletes a lead (sets deletedAt/deletedBy). No restore endpoint exists yet for this module.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: crm:delete
 *     parameters: [{ $ref: '#/components/parameters/LeadIdParam' }]
 *     responses:
 *       200: { description: Lead deleted., content: { application/json: { schema: { $ref: '#/components/schemas/DeleteEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `crm:delete` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No lead with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.delete(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CRM_PERMISSIONS.DELETE),
  validate({ params: leadIdParamSchema }),
  LeadController.delete,
);

/**
 * @swagger
 * /crm/{id}/convert:
 *   post:
 *     tags: [CRM]
 *     summary: Convert a lead into a client
 *     description: >
 *       Atomically finds-or-creates the Client for the lead's business,
 *       ensures a primary ContactRole for the lead's contact (if the lead
 *       has one), and records a LeadConversion. Rejected with 409 if the
 *       lead has already been converted or has no linked business.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: crm:manage
 *     parameters: [{ $ref: '#/components/parameters/LeadIdParam' }]
 *     requestBody:
 *       required: false
 *       content: { application/json: { schema: { $ref: '#/components/schemas/ConvertLeadRequest' } } }
 *     responses:
 *       200: { description: Lead converted., content: { application/json: { schema: { $ref: '#/components/schemas/LeadEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `crm:manage` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No lead with this ID exists in the tenant, or its linked business no longer exists., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       409: { description: Lead already converted, has no linked business, or a concurrent conversion for the same business just committed., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.post(
  '/:id/convert',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CRM_PERMISSIONS.MANAGE),
  validate({ params: leadIdParamSchema, body: convertLeadSchema }),
  LeadController.convert,
);

export default router;
