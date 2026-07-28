import { Router } from 'express';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { requirePermission } from '@middlewares/permission.middleware';
import { validate } from '@middlewares/validation.middleware';
import { BusinessController } from '../controller/business.controller';
import { BUSINESS_PERMISSIONS } from '../constants/business.permissions';
import {
  createBusinessSchema,
  updateBusinessSchema,
  listBusinessesQuerySchema,
  businessIdParamSchema,
} from '../schemas/business.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Business Routes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every route runs: authMiddleware → tenantMiddleware → requirePermission →
 * validate → controller. Mirrors `modules/projects/routes/project.routes.ts`.
 *
 * `/types` is a static-segment route and must precede `/:id` — Express
 * matches routes in registration order, and `/:id` would otherwise swallow
 * it. It lists `BusinessType` reference data (shared across tenants), which
 * is why it's gated on `BUSINESS_PERMISSIONS.READ` rather than a separate
 * resource — there's no dedicated business-types permission, and reading the
 * type catalog is a prerequisite for reading/creating businesses at all.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     BusinessStatus:
 *       type: string
 *       enum: [ACTIVE, INACTIVE, DORMANT, STRUCK_OFF, DISSOLVED]
 *       description: Lifecycle status. Defaults to ACTIVE on creation; not settable through any endpoint yet.
 *     Business:
 *       type: object
 *       description: A business (client entity) response as returned by the API — never the raw database row.
 *       properties:
 *         id: { type: string, format: uuid }
 *         typeId: { type: string, format: uuid }
 *         name: { type: string, example: Acme Manufacturing Pvt Ltd }
 *         legalName: { type: string, nullable: true }
 *         status: { $ref: '#/components/schemas/BusinessStatus' }
 *         pan: { type: string, nullable: true, example: ABCDE1234F }
 *         gstin: { type: string, nullable: true, example: 27ABCDE1234F1Z5 }
 *         cin: { type: string, nullable: true }
 *         incorporationDate: { type: string, format: date-time, nullable: true }
 *         financialYearStart: { type: integer, minimum: 1, maximum: 12, example: 4 }
 *         industry: { type: string, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *       required: [id, typeId, name, status, financialYearStart, createdAt, updatedAt]
 *     BusinessType:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         code: { type: string, example: PRIVATE_LIMITED }
 *         name: { type: string, example: Private Limited }
 *         description: { type: string, nullable: true }
 *         isActive: { type: boolean }
 *       required: [id, code, name, isActive]
 *     CreateBusinessRequest:
 *       type: object
 *       required: [typeId, name]
 *       properties:
 *         typeId: { type: string, format: uuid }
 *         name: { type: string, minLength: 2, maxLength: 255 }
 *         legalName: { type: string, maxLength: 255 }
 *         pan: { type: string, pattern: '^[A-Za-z]{5}[0-9]{4}[A-Za-z]$' }
 *         gstin: { type: string, pattern: '^[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][1-9A-Za-z]Z[0-9A-Za-z]$' }
 *         cin: { type: string, maxLength: 21 }
 *         incorporationDate: { type: string, format: date-time }
 *         financialYearStart: { type: integer, minimum: 1, maximum: 12 }
 *         industry: { type: string, maxLength: 100 }
 *     UpdateBusinessRequest:
 *       type: object
 *       description: Partial update. typeId is immutable after creation — reassigning a business's type is not supported by this endpoint.
 *       properties:
 *         name: { type: string, minLength: 2, maxLength: 255 }
 *         legalName: { type: string, maxLength: 255, nullable: true }
 *         pan: { type: string, nullable: true }
 *         gstin: { type: string, nullable: true }
 *         cin: { type: string, maxLength: 21, nullable: true }
 *         incorporationDate: { type: string, format: date-time, nullable: true }
 *         financialYearStart: { type: integer, minimum: 1, maximum: 12, nullable: true }
 *         industry: { type: string, maxLength: 100, nullable: true }
 *     BusinessEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Success }
 *         data: { $ref: '#/components/schemas/Business' }
 *         timestamp: { type: string, format: date-time }
 *         correlationId: { type: string, format: uuid }
 *         durationMs: { type: number }
 *     BusinessListEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Fetched successfully }
 *         data: { type: array, items: { $ref: '#/components/schemas/Business' } }
 *         meta: { $ref: '#/components/schemas/PaginationMeta' }
 *         timestamp: { type: string, format: date-time }
 *         correlationId: { type: string, format: uuid }
 *     BusinessTypeListEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Fetched successfully }
 *         data: { type: array, items: { $ref: '#/components/schemas/BusinessType' } }
 *         timestamp: { type: string, format: date-time }
 *         correlationId: { type: string, format: uuid }
 *   parameters:
 *     BusinessIdParam:
 *       name: id
 *       in: path
 *       required: true
 *       schema: { type: string, format: uuid }
 *       description: Business ID.
 */

// ─── Static-segment routes (must precede /:id) ───────────────────────────────

/**
 * @swagger
 * /business:
 *   post:
 *     tags: [Business]
 *     summary: Create a business
 *     description: Creates a new business (client entity) in ACTIVE status.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: business:create
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateBusinessRequest' }
 *     responses:
 *       201:
 *         description: Business created.
 *         content: { application/json: { schema: { $ref: '#/components/schemas/BusinessEnvelope' } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `business:create` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       409: { description: Referenced typeId does not exist (foreign key violation)., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed (e.g. invalid PAN/GSTIN format)., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.post(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(BUSINESS_PERMISSIONS.CREATE),
  validate({ body: createBusinessSchema }),
  BusinessController.create,
);

/**
 * @swagger
 * /business:
 *   get:
 *     tags: [Business]
 *     summary: List businesses
 *     description: Paginated, filterable, searchable list of businesses scoped to the current tenant.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: business:read
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
 *         description: Case-insensitive match against name, legal name, PAN, or GSTIN.
 *         schema: { type: string, maxLength: 100 }
 *       - name: typeId
 *         in: query
 *         schema: { type: string, format: uuid }
 *       - name: status
 *         in: query
 *         schema: { $ref: '#/components/schemas/BusinessStatus' }
 *     responses:
 *       200:
 *         description: Paginated list of businesses.
 *         content: { application/json: { schema: { $ref: '#/components/schemas/BusinessListEnvelope' } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `business:read` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Invalid query parameters., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.get(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(BUSINESS_PERMISSIONS.READ),
  validate({ query: listBusinessesQuerySchema }),
  BusinessController.list,
);

/**
 * @swagger
 * /business/types:
 *   get:
 *     tags: [Business]
 *     summary: List active business types
 *     description: Returns the shared (cross-tenant) reference catalog of business types, ordered by name. Used to populate the Business Type picker.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: business:read
 *     responses:
 *       200:
 *         description: Active business types.
 *         content: { application/json: { schema: { $ref: '#/components/schemas/BusinessTypeListEnvelope' } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `business:read` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.get(
  '/types',
  authMiddleware,
  tenantMiddleware,
  requirePermission(BUSINESS_PERMISSIONS.READ),
  BusinessController.listTypes,
);

// ─── /:id routes ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /business/{id}:
 *   get:
 *     tags: [Business]
 *     summary: Get a business by ID
 *     security: [{ BearerAuth: [] }]
 *     x-permission: business:read
 *     parameters: [{ $ref: '#/components/parameters/BusinessIdParam' }]
 *     responses:
 *       200: { description: Business found., content: { application/json: { schema: { $ref: '#/components/schemas/BusinessEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `business:read` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No business with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: id is not a valid UUID., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.get(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(BUSINESS_PERMISSIONS.READ),
  validate({ params: businessIdParamSchema }),
  BusinessController.getById,
);

/**
 * @swagger
 * /business/{id}:
 *   patch:
 *     tags: [Business]
 *     summary: Update a business
 *     description: Partial update of mutable business fields. typeId cannot be changed through this endpoint.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: business:update
 *     parameters: [{ $ref: '#/components/parameters/BusinessIdParam' }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/UpdateBusinessRequest' } } }
 *     responses:
 *       200: { description: Business updated., content: { application/json: { schema: { $ref: '#/components/schemas/BusinessEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `business:update` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No business with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed (e.g. invalid PAN/GSTIN format)., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.patch(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(BUSINESS_PERMISSIONS.UPDATE),
  validate({ params: businessIdParamSchema, body: updateBusinessSchema }),
  BusinessController.update,
);

/**
 * @swagger
 * /business/{id}:
 *   delete:
 *     tags: [Business]
 *     summary: Soft-delete a business
 *     description: Soft-deletes a business (sets deletedAt/deletedBy). No restore endpoint exists yet for this module.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: business:delete
 *     parameters: [{ $ref: '#/components/parameters/BusinessIdParam' }]
 *     responses:
 *       200: { description: Business deleted., content: { application/json: { schema: { $ref: '#/components/schemas/DeleteEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `business:delete` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No business with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.delete(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(BUSINESS_PERMISSIONS.DELETE),
  validate({ params: businessIdParamSchema }),
  BusinessController.delete,
);

export default router;
