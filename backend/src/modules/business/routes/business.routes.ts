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
  assignBusinessSchema,
  businessAssignmentParamSchema,
  createBusinessNoteSchema,
  businessTimelineQuerySchema,
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
 *         tradeName: { type: string, nullable: true, description: 'PRD §8.3 — the name the business trades under, when different from legalName.' }
 *         status: { $ref: '#/components/schemas/BusinessStatus' }
 *         pan: { type: string, nullable: true, example: ABCDE1234F }
 *         gstin: { type: string, nullable: true, example: 27ABCDE1234F1Z5 }
 *         cin: { type: string, nullable: true }
 *         din: { type: string, nullable: true, description: 'PRD §8.3 — Director Identification Number.' }
 *         tan: { type: string, nullable: true, description: 'PRD §8.3 — Tax Deduction and Collection Account Number.' }
 *         incorporationDate: { type: string, format: date-time, nullable: true }
 *         financialYearStart: { type: integer, minimum: 1, maximum: 12, example: 4 }
 *         industry: { type: string, nullable: true }
 *         website: { type: string, nullable: true, example: https://acme.example.com }
 *         phone: { type: string, nullable: true }
 *         email: { type: string, nullable: true }
 *         storageQuotaMb: { type: integer, nullable: true, description: 'PRD §7.4 — per-business storage quota override in MB. Null means the business inherits the tenant''s default quota.' }
 *         storageUsage:
 *           type: object
 *           description: 'PRD §7.4 — live storage usage summary. Only present on GET /business/{id}, omitted from the list endpoint.'
 *           properties:
 *             usedBytes: { type: integer }
 *             quotaBytes: { type: integer }
 *             remainingBytes: { type: integer }
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
 *         tradeName: { type: string, maxLength: 255 }
 *         pan: { type: string, pattern: '^[A-Za-z]{5}[0-9]{4}[A-Za-z]$' }
 *         gstin: { type: string, pattern: '^[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][1-9A-Za-z]Z[0-9A-Za-z]$' }
 *         cin: { type: string, maxLength: 21 }
 *         din: { type: string, maxLength: 20 }
 *         tan: { type: string, maxLength: 10 }
 *         incorporationDate: { type: string, format: date-time }
 *         financialYearStart: { type: integer, minimum: 1, maximum: 12 }
 *         industry: { type: string, maxLength: 100 }
 *         website: { type: string, format: uri, maxLength: 255 }
 *         phone: { type: string, maxLength: 30 }
 *         email: { type: string, format: email, maxLength: 255 }
 *     UpdateBusinessRequest:
 *       type: object
 *       description: Partial update. typeId is immutable after creation — reassigning a business's type is not supported by this endpoint.
 *       properties:
 *         name: { type: string, minLength: 2, maxLength: 255 }
 *         legalName: { type: string, maxLength: 255, nullable: true }
 *         tradeName: { type: string, maxLength: 255, nullable: true }
 *         pan: { type: string, nullable: true }
 *         gstin: { type: string, nullable: true }
 *         cin: { type: string, maxLength: 21, nullable: true }
 *         din: { type: string, maxLength: 20, nullable: true }
 *         tan: { type: string, maxLength: 10, nullable: true }
 *         incorporationDate: { type: string, format: date-time, nullable: true }
 *         financialYearStart: { type: integer, minimum: 1, maximum: 12, nullable: true }
 *         industry: { type: string, maxLength: 100, nullable: true }
 *         website: { type: string, format: uri, maxLength: 255, nullable: true }
 *         phone: { type: string, maxLength: 30, nullable: true }
 *         email: { type: string, format: email, maxLength: 255, nullable: true }
 *         storageQuotaMb: { type: integer, minimum: 1, nullable: true, description: 'PRD §7.4 — set to override this business''s storage quota, or null to revert to the tenant default.' }
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
 *     BusinessAssignment:
 *       type: object
 *       description: PRD §8.5 — a staff member assigned to a Business, with a free-text role (e.g. Relationship Manager, Accountant, Auditor, Reviewer).
 *       properties:
 *         id: { type: string, format: uuid }
 *         businessId: { type: string, format: uuid }
 *         userId: { type: string, format: uuid }
 *         role: { type: string, example: Relationship Manager }
 *         assignedAt: { type: string, format: date-time }
 *       required: [id, businessId, userId, role, assignedAt]
 *     AssignBusinessRequest:
 *       type: object
 *       required: [userId, role]
 *       properties:
 *         userId: { type: string, format: uuid }
 *         role: { type: string, minLength: 1, maxLength: 50, example: Accountant }
 *     BusinessAssignmentEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Created successfully }
 *         data: { $ref: '#/components/schemas/BusinessAssignment' }
 *         timestamp: { type: string, format: date-time }
 *         correlationId: { type: string, format: uuid }
 *     BusinessAssignmentListEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Fetched successfully }
 *         data: { type: array, items: { $ref: '#/components/schemas/BusinessAssignment' } }
 *         timestamp: { type: string, format: date-time }
 *         correlationId: { type: string, format: uuid }
 *     BusinessNote:
 *       type: object
 *       description: PRD §8.6 — an internal note on a Business (never stored inside Lead). Only firm users can read these — never exposed to the Client portal.
 *       properties:
 *         id: { type: string, format: uuid }
 *         businessId: { type: string, format: uuid }
 *         authorId: { type: string, format: uuid }
 *         content: { type: string }
 *         documentId: { type: string, format: uuid, nullable: true, description: Optional attachment reference to an existing Document. }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *       required: [id, businessId, authorId, content, createdAt, updatedAt]
 *     CreateBusinessNoteRequest:
 *       type: object
 *       required: [content]
 *       properties:
 *         content: { type: string, minLength: 1, maxLength: 5000 }
 *         documentId: { type: string, format: uuid }
 *     BusinessNoteEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Created successfully }
 *         data: { $ref: '#/components/schemas/BusinessNote' }
 *         timestamp: { type: string, format: date-time }
 *         correlationId: { type: string, format: uuid }
 *     BusinessNoteListEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Fetched successfully }
 *         data: { type: array, items: { $ref: '#/components/schemas/BusinessNote' } }
 *         timestamp: { type: string, format: date-time }
 *         correlationId: { type: string, format: uuid }
 *     BusinessTimelineEnvelope:
 *       type: object
 *       description: PRD §8.11 — reuses the `AuditLog` shape, not a bespoke timeline entry type.
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Fetched successfully }
 *         data:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id: { type: string, format: uuid }
 *               eventType: { type: string }
 *               actorId: { type: string, format: uuid }
 *               actorName: { type: string }
 *               targetType: { type: string, nullable: true }
 *               targetId: { type: string, format: uuid, nullable: true }
 *               description: { type: string }
 *               ipAddress: { type: string, nullable: true }
 *               createdAt: { type: string, format: date-time }
 *         meta: { $ref: '#/components/schemas/PaginationMeta' }
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
 *         description: Case-insensitive match against name, legal name, PAN, GSTIN, phone, or email.
 *         schema: { type: string, maxLength: 100 }
 *       - name: typeId
 *         in: query
 *         schema: { type: string, format: uuid }
 *       - name: status
 *         in: query
 *         schema: { $ref: '#/components/schemas/BusinessStatus' }
 *       - name: assignedStaffUserId
 *         in: query
 *         description: PRD §8.9 — restrict to businesses with a BusinessAssignment for this user.
 *         schema: { type: string, format: uuid }
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

/**
 * @swagger
 * /business/{id}/assignments:
 *   get:
 *     tags: [Business]
 *     summary: List a business's staff assignments
 *     description: PRD §8.5 — returns every staff member assigned to this business, most recently assigned first.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: business:read
 *     parameters: [{ $ref: '#/components/parameters/BusinessIdParam' }]
 *     responses:
 *       200: { description: The business's assignments., content: { application/json: { schema: { $ref: '#/components/schemas/BusinessAssignmentListEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `business:read` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No business with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.get(
  '/:id/assignments',
  authMiddleware,
  tenantMiddleware,
  requirePermission(BUSINESS_PERMISSIONS.READ),
  validate({ params: businessIdParamSchema }),
  BusinessController.listAssignments,
);

/**
 * @swagger
 * /business/{id}/assignments:
 *   post:
 *     tags: [Business]
 *     summary: Assign a staff member to a business
 *     description: PRD §8.5 — a business may have multiple assigned staff, each with a role. Rejected with 409 if this user is already assigned (unassign first to change their role).
 *     security: [{ BearerAuth: [] }]
 *     x-permission: business:manage
 *     parameters: [{ $ref: '#/components/parameters/BusinessIdParam' }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/AssignBusinessRequest' } } }
 *     responses:
 *       201: { description: Staff member assigned., content: { application/json: { schema: { $ref: '#/components/schemas/BusinessAssignmentEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `business:manage` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No business with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       409: { description: This user is already assigned to this business, or userId does not exist (foreign key violation)., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.post(
  '/:id/assignments',
  authMiddleware,
  tenantMiddleware,
  requirePermission(BUSINESS_PERMISSIONS.MANAGE),
  validate({ params: businessIdParamSchema, body: assignBusinessSchema }),
  BusinessController.assign,
);

/**
 * @swagger
 * /business/{id}/assignments/{userId}:
 *   delete:
 *     tags: [Business]
 *     summary: Remove a staff member from a business
 *     security: [{ BearerAuth: [] }]
 *     x-permission: business:manage
 *     parameters:
 *       - { $ref: '#/components/parameters/BusinessIdParam' }
 *       - name: userId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Assignment removed., content: { application/json: { schema: { $ref: '#/components/schemas/DeleteEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `business:manage` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No business with this ID exists in the tenant, or this user is not assigned to it., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.delete(
  '/:id/assignments/:userId',
  authMiddleware,
  tenantMiddleware,
  requirePermission(BUSINESS_PERMISSIONS.MANAGE),
  validate({ params: businessAssignmentParamSchema }),
  BusinessController.unassign,
);

/**
 * @swagger
 * /business/{id}/timeline:
 *   get:
 *     tags: [Business]
 *     summary: A business's timeline
 *     description: PRD §8.11 — every `AuditLog` entry recorded for this business (assignment changes, PAN/GST/details updates, notes, etc.), newest first. Reuses AuditLog rather than a second history table.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: business:read
 *     parameters:
 *       - { $ref: '#/components/parameters/BusinessIdParam' }
 *       - name: page
 *         in: query
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200: { description: The business's timeline., content: { application/json: { schema: { $ref: '#/components/schemas/BusinessTimelineEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `business:read` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No business with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.get(
  '/:id/timeline',
  authMiddleware,
  tenantMiddleware,
  requirePermission(BUSINESS_PERMISSIONS.READ),
  validate({ params: businessIdParamSchema, query: businessTimelineQuerySchema }),
  BusinessController.timeline,
);

/**
 * @swagger
 * /business/{id}/notes:
 *   get:
 *     tags: [Business]
 *     summary: List a business's notes
 *     description: PRD §8.6 — returns every internal CRM note for this business, newest first. Only firm users can read them.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: business:read
 *     parameters: [{ $ref: '#/components/parameters/BusinessIdParam' }]
 *     responses:
 *       200: { description: The business's notes., content: { application/json: { schema: { $ref: '#/components/schemas/BusinessNoteListEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `business:read` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No business with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.get(
  '/:id/notes',
  authMiddleware,
  tenantMiddleware,
  requirePermission(BUSINESS_PERMISSIONS.READ),
  validate({ params: businessIdParamSchema }),
  BusinessController.listNotes,
);

/**
 * @swagger
 * /business/{id}/notes:
 *   post:
 *     tags: [Business]
 *     summary: Add a note to a business
 *     description: PRD §8.6 — records an internal CRM note (author/date/content, optional attachment). Never visible to the Client portal.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: business:update
 *     parameters: [{ $ref: '#/components/parameters/BusinessIdParam' }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/CreateBusinessNoteRequest' } } }
 *     responses:
 *       201: { description: Note added., content: { application/json: { schema: { $ref: '#/components/schemas/BusinessNoteEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `business:update` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No business with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       409: { description: Referenced documentId does not exist (foreign key violation)., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.post(
  '/:id/notes',
  authMiddleware,
  tenantMiddleware,
  requirePermission(BUSINESS_PERMISSIONS.UPDATE),
  validate({ params: businessIdParamSchema, body: createBusinessNoteSchema }),
  BusinessController.addNote,
);

export default router;
