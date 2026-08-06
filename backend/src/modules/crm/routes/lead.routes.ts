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
  createLeadNoteSchema,
  assignLeadSchema,
  leadAssignmentParamSchema,
  sendProposalSchema,
  respondProposalSchema,
  leadTimelineQuerySchema,
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
 *         priority: { allOf: [{ $ref: '#/components/schemas/LeadPriority' }], nullable: true }
 *         expectedRevenue: { type: number, nullable: true }
 *         probability: { type: integer, nullable: true, minimum: 0, maximum: 100 }
 *         expectedCloseDate: { type: string, format: date-time, nullable: true }
 *         interestedServices: { type: array, items: { type: string } }
 *         proposalSentAt: { type: string, format: date-time, nullable: true }
 *         proposalAcceptedAt: { type: string, format: date-time, nullable: true }
 *         proposalRejectedAt: { type: string, format: date-time, nullable: true }
 *         proposalValue: { type: number, nullable: true }
 *         proposalRemarks: { type: string, nullable: true }
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
 *         priority: { $ref: '#/components/schemas/LeadPriority' }
 *         expectedRevenue: { type: number, minimum: 0 }
 *         probability: { type: integer, minimum: 0, maximum: 100 }
 *         expectedCloseDate: { type: string, format: date-time }
 *         interestedServices: { type: array, items: { type: string } }
 *     UpdateLeadRequest:
 *       type: object
 *       description: Partial update.
 *       properties:
 *         businessId: { type: string, format: uuid, nullable: true }
 *         contactId: { type: string, format: uuid, nullable: true }
 *         title: { type: string, minLength: 2, maxLength: 255 }
 *         sourceId: { type: string, format: uuid }
 *         stageId: { type: string, format: uuid }
 *         priority: { allOf: [{ $ref: '#/components/schemas/LeadPriority' }], nullable: true }
 *         expectedRevenue: { type: number, minimum: 0, nullable: true }
 *         probability: { type: integer, minimum: 0, maximum: 100, nullable: true }
 *         expectedCloseDate: { type: string, format: date-time, nullable: true }
 *         interestedServices: { type: array, items: { type: string } }
 *     ConvertLeadRequest:
 *       type: object
 *       properties:
 *         notes: { type: string, maxLength: 1000 }
 *     SendProposalRequest:
 *       type: object
 *       properties:
 *         proposalValue: { type: number, minimum: 0 }
 *         proposalRemarks: { type: string, maxLength: 2000 }
 *     RespondProposalRequest:
 *       type: object
 *       properties:
 *         proposalRemarks: { type: string, maxLength: 2000 }
 *     LeadNote:
 *       type: object
 *       description: PRD §8.6 — a chronological CRM note (never stored inside Business).
 *       properties:
 *         id: { type: string, format: uuid }
 *         leadId: { type: string, format: uuid }
 *         authorId: { type: string, format: uuid }
 *         content: { type: string }
 *         documentId: { type: string, format: uuid, nullable: true, description: Optional attachment reference to an existing Document. }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *       required: [id, leadId, authorId, content, createdAt, updatedAt]
 *     CreateLeadNoteRequest:
 *       type: object
 *       required: [content]
 *       properties:
 *         content: { type: string, minLength: 1, maxLength: 5000 }
 *         documentId: { type: string, format: uuid }
 *     LeadNoteEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Created successfully }
 *         data: { $ref: '#/components/schemas/LeadNote' }
 *         timestamp: { type: string, format: date-time }
 *         correlationId: { type: string, format: uuid }
 *     LeadNoteListEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Fetched successfully }
 *         data: { type: array, items: { $ref: '#/components/schemas/LeadNote' } }
 *         timestamp: { type: string, format: date-time }
 *         correlationId: { type: string, format: uuid }
 *     LeadAssignment:
 *       type: object
 *       description: PRD §8.5 — a staff member assigned to a pre-conversion Lead. `isPrimary` marks the "lead owner" (PRD §8.4).
 *       properties:
 *         id: { type: string, format: uuid }
 *         leadId: { type: string, format: uuid }
 *         userId: { type: string, format: uuid }
 *         isPrimary: { type: boolean }
 *         assignedAt: { type: string, format: date-time }
 *       required: [id, leadId, userId, isPrimary, assignedAt]
 *     AssignLeadRequest:
 *       type: object
 *       required: [userId]
 *       properties:
 *         userId: { type: string, format: uuid }
 *         isPrimary: { type: boolean, description: 'PRD §8.4 — marks this assignment as the lead owner, clearing any prior primary.' }
 *     LeadAssignmentEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Created successfully }
 *         data: { $ref: '#/components/schemas/LeadAssignment' }
 *         timestamp: { type: string, format: date-time }
 *         correlationId: { type: string, format: uuid }
 *     LeadAssignmentListEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Fetched successfully }
 *         data: { type: array, items: { $ref: '#/components/schemas/LeadAssignment' } }
 *         timestamp: { type: string, format: date-time }
 *         correlationId: { type: string, format: uuid }
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
 *     LeadPriority:
 *       type: string
 *       enum: [LOW, MEDIUM, HIGH, URGENT]
 *     LeadDashboardStats:
 *       type: object
 *       description: PRD §8.10.
 *       properties:
 *         totalLeads: { type: integer }
 *         activeProposals: { type: integer }
 *         convertedClients: { type: integer }
 *         archivedClients: { type: integer }
 *         conversionRate: { type: number, description: Percentage, e.g. 24.5. }
 *         leadsBySource:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               sourceId: { type: string, format: uuid }
 *               sourceName: { type: string }
 *               count: { type: integer }
 *         upcomingFollowUps: { type: integer }
 *     LeadDashboardEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Fetched successfully }
 *         data: { $ref: '#/components/schemas/LeadDashboardStats' }
 *         timestamp: { type: string, format: date-time }
 *         correlationId: { type: string, format: uuid }
 *     LeadTimelineEnvelope:
 *       type: object
 *       description: PRD §8.11 — reuses the `AuditLog` shape (`AuditLogResponseDto`), not a bespoke timeline entry type.
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
 *       - name: priority
 *         in: query
 *         schema: { $ref: '#/components/schemas/LeadPriority' }
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

/**
 * @swagger
 * /crm/dashboard:
 *   get:
 *     tags: [CRM]
 *     summary: CRM dashboard statistics
 *     description: >
 *       PRD §8.10 — total leads, active proposals, converted/archived clients
 *       (reusing `Client.status`), conversion rate, lead-sources breakdown,
 *       and upcoming follow-ups (reusing Tasks).
 *     security: [{ BearerAuth: [] }]
 *     x-permission: crm:read
 *     responses:
 *       200: { description: Dashboard statistics., content: { application/json: { schema: { $ref: '#/components/schemas/LeadDashboardEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `crm:read` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.get(
  '/dashboard',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CRM_PERMISSIONS.READ),
  LeadController.dashboard,
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

/**
 * @swagger
 * /crm/{id}/proposal/send:
 *   post:
 *     tags: [CRM]
 *     summary: Send a proposal for a lead
 *     description: PRD §8.2 — sets `proposalSentAt` (and clears any prior accepted/rejected timestamps). Dedicated action, not a raw PATCH, so the proposal timestamps can never be set out of order.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: crm:update
 *     parameters: [{ $ref: '#/components/parameters/LeadIdParam' }]
 *     requestBody:
 *       required: false
 *       content: { application/json: { schema: { $ref: '#/components/schemas/SendProposalRequest' } } }
 *     responses:
 *       200: { description: Proposal sent., content: { application/json: { schema: { $ref: '#/components/schemas/LeadEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `crm:update` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No lead with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.post(
  '/:id/proposal/send',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CRM_PERMISSIONS.UPDATE),
  validate({ params: leadIdParamSchema, body: sendProposalSchema }),
  LeadController.sendProposal,
);

/**
 * @swagger
 * /crm/{id}/proposal/accept:
 *   post:
 *     tags: [CRM]
 *     summary: Accept a lead's proposal
 *     description: PRD §8.2 — sets `proposalAcceptedAt`. Rejected with 409 if no proposal has been sent yet.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: crm:update
 *     parameters: [{ $ref: '#/components/parameters/LeadIdParam' }]
 *     requestBody:
 *       required: false
 *       content: { application/json: { schema: { $ref: '#/components/schemas/RespondProposalRequest' } } }
 *     responses:
 *       200: { description: Proposal accepted., content: { application/json: { schema: { $ref: '#/components/schemas/LeadEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `crm:update` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No lead with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       409: { description: No proposal has been sent for this lead yet., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.post(
  '/:id/proposal/accept',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CRM_PERMISSIONS.UPDATE),
  validate({ params: leadIdParamSchema, body: respondProposalSchema }),
  LeadController.acceptProposal,
);

/**
 * @swagger
 * /crm/{id}/proposal/reject:
 *   post:
 *     tags: [CRM]
 *     summary: Reject a lead's proposal
 *     description: PRD §8.2 — sets `proposalRejectedAt`. Rejected with 409 if no proposal has been sent yet.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: crm:update
 *     parameters: [{ $ref: '#/components/parameters/LeadIdParam' }]
 *     requestBody:
 *       required: false
 *       content: { application/json: { schema: { $ref: '#/components/schemas/RespondProposalRequest' } } }
 *     responses:
 *       200: { description: Proposal rejected., content: { application/json: { schema: { $ref: '#/components/schemas/LeadEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `crm:update` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No lead with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       409: { description: No proposal has been sent for this lead yet., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.post(
  '/:id/proposal/reject',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CRM_PERMISSIONS.UPDATE),
  validate({ params: leadIdParamSchema, body: respondProposalSchema }),
  LeadController.rejectProposal,
);

/**
 * @swagger
 * /crm/{id}/timeline:
 *   get:
 *     tags: [CRM]
 *     summary: A lead's timeline
 *     description: PRD §8.11 — every `AuditLog` entry recorded for this lead (created, stage changes, proposal actions, conversion, assignment changes, notes), newest first. Reuses AuditLog rather than a second history table.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: crm:read
 *     parameters:
 *       - { $ref: '#/components/parameters/LeadIdParam' }
 *       - name: page
 *         in: query
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200: { description: The lead's timeline., content: { application/json: { schema: { $ref: '#/components/schemas/LeadTimelineEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `crm:read` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No lead with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.get(
  '/:id/timeline',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CRM_PERMISSIONS.READ),
  validate({ params: leadIdParamSchema, query: leadTimelineQuerySchema }),
  LeadController.timeline,
);

/**
 * @swagger
 * /crm/{id}/notes:
 *   get:
 *     tags: [CRM]
 *     summary: List a lead's notes
 *     description: PRD §8.6 — returns every chronological CRM note for this lead, newest first.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: crm:read
 *     parameters: [{ $ref: '#/components/parameters/LeadIdParam' }]
 *     responses:
 *       200: { description: The lead's notes., content: { application/json: { schema: { $ref: '#/components/schemas/LeadNoteListEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `crm:read` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No lead with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.get(
  '/:id/notes',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CRM_PERMISSIONS.READ),
  validate({ params: leadIdParamSchema }),
  LeadController.listNotes,
);

/**
 * @swagger
 * /crm/{id}/notes:
 *   post:
 *     tags: [CRM]
 *     summary: Add a note to a lead
 *     description: PRD §8.6 — records a chronological CRM note (author/date/content, optional attachment).
 *     security: [{ BearerAuth: [] }]
 *     x-permission: crm:update
 *     parameters: [{ $ref: '#/components/parameters/LeadIdParam' }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/CreateLeadNoteRequest' } } }
 *     responses:
 *       201: { description: Note added., content: { application/json: { schema: { $ref: '#/components/schemas/LeadNoteEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `crm:update` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No lead with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       409: { description: Referenced documentId does not exist (foreign key violation)., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.post(
  '/:id/notes',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CRM_PERMISSIONS.UPDATE),
  validate({ params: leadIdParamSchema, body: createLeadNoteSchema }),
  LeadController.addNote,
);

/**
 * @swagger
 * /crm/{id}/assignments:
 *   get:
 *     tags: [CRM]
 *     summary: List a lead's staff assignments
 *     description: PRD §8.5 — returns every staff member assigned to this lead, most recently assigned first.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: crm:read
 *     parameters: [{ $ref: '#/components/parameters/LeadIdParam' }]
 *     responses:
 *       200: { description: The lead's assignments., content: { application/json: { schema: { $ref: '#/components/schemas/LeadAssignmentListEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `crm:read` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No lead with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.get(
  '/:id/assignments',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CRM_PERMISSIONS.READ),
  validate({ params: leadIdParamSchema }),
  LeadController.listAssignments,
);

/**
 * @swagger
 * /crm/{id}/assignments:
 *   post:
 *     tags: [CRM]
 *     summary: Assign a staff member to a lead
 *     description: PRD §8.5 — a lead may have multiple assigned staff. Rejected with 409 if this user is already assigned.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: crm:manage
 *     parameters: [{ $ref: '#/components/parameters/LeadIdParam' }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/AssignLeadRequest' } } }
 *     responses:
 *       201: { description: Staff member assigned., content: { application/json: { schema: { $ref: '#/components/schemas/LeadAssignmentEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `crm:manage` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No lead with this ID exists in the tenant., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       409: { description: This user is already assigned to this lead, or userId does not exist (foreign key violation)., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.post(
  '/:id/assignments',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CRM_PERMISSIONS.MANAGE),
  validate({ params: leadIdParamSchema, body: assignLeadSchema }),
  LeadController.assign,
);

/**
 * @swagger
 * /crm/{id}/assignments/{userId}:
 *   delete:
 *     tags: [CRM]
 *     summary: Remove a staff member from a lead
 *     security: [{ BearerAuth: [] }]
 *     x-permission: crm:manage
 *     parameters:
 *       - { $ref: '#/components/parameters/LeadIdParam' }
 *       - name: userId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Assignment removed., content: { application/json: { schema: { $ref: '#/components/schemas/DeleteEnvelope' } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller lacks the `crm:manage` permission., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No lead with this ID exists in the tenant, or this user is not assigned to it., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.delete(
  '/:id/assignments/:userId',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CRM_PERMISSIONS.MANAGE),
  validate({ params: leadAssignmentParamSchema }),
  LeadController.unassign,
);

export default router;
