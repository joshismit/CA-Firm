import { Router } from 'express';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { requirePermission } from '@middlewares/permission.middleware';
import { validate } from '@middlewares/validation.middleware';
import { ProjectController } from '../controller/project.controller';
import { PROJECT_PERMISSIONS } from '../constants/project.permissions';
import {
  createProjectSchema,
  updateProjectSchema,
  updateProjectStatusSchema,
  listProjectsQuerySchema,
  projectIdParamSchema,
  projectCodeParamSchema,
  clientIdParamSchema,
  managerIdParamSchema,
} from '../schemas/project.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Project Routes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every route runs: authMiddleware → tenantMiddleware → requirePermission →
 * validate → controller.
 *
 * `authMiddleware` only decodes the JWT onto `req.user`. `BaseService` (which
 * `ProjectService` extends) reads `req.tenant.id` — populated by
 * `tenantMiddleware`, not `authMiddleware` — so both must run on every route or
 * every repository call fails its tenant-isolation guard.
 *
 * Static-segment routes (`/overdue`, `/code/:code`, `/client/:clientId`,
 * `/manager/:managerId`) are registered before `/:id` — Express matches routes
 * in registration order, and `/:id` would otherwise swallow those paths.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     ProjectStatus:
 *       type: string
 *       enum: [DRAFT, PLANNED, ACTIVE, ON_HOLD, COMPLETED, ARCHIVED, CANCELLED]
 *       description: >
 *         Lifecycle status. Valid transitions: DRAFT→PLANNED→ACTIVE⇄ON_HOLD→COMPLETED,
 *         COMPLETED→ACTIVE (reopen), any non-terminal→CANCELLED (terminal).
 *         ARCHIVED is only reachable via POST /projects/{id}/archive, and is
 *         read-only once set.
 *     Project:
 *       type: object
 *       description: A project (engagement) response as returned by the API — never the raw database row.
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         code:
 *           type: string
 *           example: AUD-2026-001
 *         name:
 *           type: string
 *           example: FY26 Statutory Audit
 *         status:
 *           $ref: '#/components/schemas/ProjectStatus'
 *         clientId:
 *           type: string
 *           format: uuid
 *         managerId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         startDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         dueDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         completedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         archivedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         isOverdue:
 *           type: boolean
 *           description: Computed — true if dueDate has passed and status is not COMPLETED/ARCHIVED/CANCELLED.
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       required: [id, code, name, status, clientId, isOverdue, createdAt, updatedAt]
 *     PaginationMeta:
 *       type: object
 *       properties:
 *         page: { type: integer, example: 1 }
 *         limit: { type: integer, example: 20 }
 *         total: { type: integer, example: 42 }
 *         totalPages: { type: integer, example: 3 }
 *         hasNextPage: { type: boolean }
 *         hasPrevPage: { type: boolean }
 *     CreateProjectRequest:
 *       type: object
 *       required: [clientId, code, name]
 *       properties:
 *         clientId:
 *           type: string
 *           format: uuid
 *         managerId:
 *           type: string
 *           format: uuid
 *         code:
 *           type: string
 *           minLength: 2
 *           maxLength: 50
 *           pattern: '^[A-Za-z0-9\-/_.]+$'
 *           description: Tenant-unique engagement code. Letters, numbers, and - / _ . only.
 *           example: AUD-2026-001
 *         name:
 *           type: string
 *           minLength: 2
 *           maxLength: 255
 *           example: FY26 Statutory Audit
 *         startDate:
 *           type: string
 *           format: date-time
 *         dueDate:
 *           type: string
 *           format: date-time
 *     UpdateProjectRequest:
 *       type: object
 *       description: Partial update. clientId and code are immutable after creation — reassigning a client is not supported by this endpoint.
 *       properties:
 *         managerId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         name:
 *           type: string
 *           minLength: 2
 *           maxLength: 255
 *         startDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         dueDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *     UpdateProjectStatusRequest:
 *       type: object
 *       required: [status]
 *       properties:
 *         status:
 *           $ref: '#/components/schemas/ProjectStatus'
 *         reason:
 *           type: string
 *           minLength: 3
 *           maxLength: 500
 *           description: Required when moving to ON_HOLD or CANCELLED.
 *     ProjectEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Success }
 *         data: { $ref: '#/components/schemas/Project' }
 *         timestamp: { type: string, format: date-time }
 *         correlationId: { type: string, format: uuid }
 *         durationMs: { type: number }
 *     ProjectListEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Fetched successfully }
 *         data:
 *           type: array
 *           items: { $ref: '#/components/schemas/Project' }
 *         meta: { $ref: '#/components/schemas/PaginationMeta' }
 *         timestamp: { type: string, format: date-time }
 *         correlationId: { type: string, format: uuid }
 *     ProjectArrayEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Fetched successfully }
 *         data:
 *           type: array
 *           items: { $ref: '#/components/schemas/Project' }
 *         timestamp: { type: string, format: date-time }
 *         correlationId: { type: string, format: uuid }
 *     DeleteEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Deleted successfully }
 *         timestamp: { type: string, format: date-time }
 *         correlationId: { type: string, format: uuid }
 *     ApiErrorResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: false }
 *         message: { type: string }
 *         error:
 *           type: object
 *           properties:
 *             code: { type: string, example: VALIDATION_ERROR }
 *             details: { type: object, nullable: true }
 *         timestamp: { type: string, format: date-time }
 *         correlationId: { type: string, format: uuid }
 *   parameters:
 *     ProjectIdParam:
 *       name: id
 *       in: path
 *       required: true
 *       schema: { type: string, format: uuid }
 *       description: Project ID.
 */

// ─── Static-segment routes (must precede /:id) ───────────────────────────────

/**
 * @swagger
 * /projects:
 *   post:
 *     tags: [Projects]
 *     summary: Create a project
 *     description: >
 *       Creates a new project (engagement) in DRAFT status for a client.
 *       The engagement `code` must be unique within the tenant.
 *     security:
 *       - BearerAuth: []
 *     x-permission: projects:create
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateProjectRequest' }
 *     responses:
 *       201:
 *         description: Project created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ProjectEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `projects:create` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       404:
 *         description: Referenced clientId or managerId does not exist.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       409:
 *         description: A project with this code already exists in the tenant.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       422:
 *         description: Validation failed (e.g. dueDate before startDate, invalid code format).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.post(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PROJECT_PERMISSIONS.CREATE),
  validate({ body: createProjectSchema }),
  ProjectController.create,
);

/**
 * @swagger
 * /projects:
 *   get:
 *     tags: [Projects]
 *     summary: List projects
 *     description: Paginated, filterable, searchable list of projects scoped to the current tenant.
 *     security:
 *       - BearerAuth: []
 *     x-permission: projects:read
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
 *         description: Case-insensitive match against project name or code.
 *         schema: { type: string, maxLength: 100 }
 *       - name: status
 *         in: query
 *         schema: { $ref: '#/components/schemas/ProjectStatus' }
 *       - name: clientId
 *         in: query
 *         schema: { type: string, format: uuid }
 *       - name: managerId
 *         in: query
 *         schema: { type: string, format: uuid }
 *       - name: dueBefore
 *         in: query
 *         schema: { type: string, format: date-time }
 *       - name: dueAfter
 *         in: query
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Paginated list of projects.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ProjectListEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `projects:read` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       422:
 *         description: Invalid query parameters.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.get(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PROJECT_PERMISSIONS.READ),
  validate({ query: listProjectsQuerySchema }),
  ProjectController.list,
);

/**
 * @swagger
 * /projects/overdue:
 *   get:
 *     tags: [Projects]
 *     summary: List overdue projects
 *     description: Returns all non-terminal (not COMPLETED/ARCHIVED/CANCELLED) projects whose dueDate has passed, ordered by dueDate ascending.
 *     security:
 *       - BearerAuth: []
 *     x-permission: projects:read
 *     responses:
 *       200:
 *         description: Overdue projects.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ProjectArrayEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `projects:read` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.get(
  '/overdue',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PROJECT_PERMISSIONS.READ),
  ProjectController.getOverdue,
);

/**
 * @swagger
 * /projects/code/{code}:
 *   get:
 *     tags: [Projects]
 *     summary: Get a project by its engagement code
 *     description: Looks up a project by its tenant-unique `code` instead of its ID.
 *     security:
 *       - BearerAuth: []
 *     x-permission: projects:read
 *     parameters:
 *       - name: code
 *         in: path
 *         required: true
 *         schema: { type: string, maxLength: 50 }
 *     responses:
 *       200:
 *         description: Project found.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ProjectEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `projects:read` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       404:
 *         description: No project with this code exists in the tenant.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.get(
  '/code/:code',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PROJECT_PERMISSIONS.READ),
  validate({ params: projectCodeParamSchema }),
  ProjectController.getByCode,
);

/**
 * @swagger
 * /projects/client/{clientId}:
 *   get:
 *     tags: [Projects]
 *     summary: List a client's projects
 *     description: Returns every project belonging to the given client, newest first. Returns an empty array if the client has no projects.
 *     security:
 *       - BearerAuth: []
 *     x-permission: projects:read
 *     parameters:
 *       - name: clientId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Client's projects.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ProjectArrayEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `projects:read` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       422:
 *         description: clientId is not a valid UUID.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.get(
  '/client/:clientId',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PROJECT_PERMISSIONS.READ),
  validate({ params: clientIdParamSchema }),
  ProjectController.getByClient,
);

/**
 * @swagger
 * /projects/manager/{managerId}:
 *   get:
 *     tags: [Projects]
 *     summary: List a manager's projects
 *     description: Returns every project managed by the given user, newest first. Returns an empty array if the manager has no projects.
 *     security:
 *       - BearerAuth: []
 *     x-permission: projects:read
 *     parameters:
 *       - name: managerId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Manager's projects.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ProjectArrayEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `projects:read` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       422:
 *         description: managerId is not a valid UUID.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.get(
  '/manager/:managerId',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PROJECT_PERMISSIONS.READ),
  validate({ params: managerIdParamSchema }),
  ProjectController.getByManager,
);

// ─── /:id routes ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /projects/{id}:
 *   get:
 *     tags: [Projects]
 *     summary: Get a project by ID
 *     security:
 *       - BearerAuth: []
 *     x-permission: projects:read
 *     parameters:
 *       - $ref: '#/components/parameters/ProjectIdParam'
 *     responses:
 *       200:
 *         description: Project found.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ProjectEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `projects:read` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       404:
 *         description: No project with this ID exists in the tenant.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       422:
 *         description: id is not a valid UUID.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.get(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PROJECT_PERMISSIONS.READ),
  validate({ params: projectIdParamSchema }),
  ProjectController.getById,
);

/**
 * @swagger
 * /projects/{id}:
 *   patch:
 *     tags: [Projects]
 *     summary: Update a project
 *     description: >
 *       Partial update of mutable project fields. clientId and code cannot be
 *       changed through this endpoint. Rejected with 409 if the project is
 *       ARCHIVED (read-only).
 *     security:
 *       - BearerAuth: []
 *     x-permission: projects:update
 *     parameters:
 *       - $ref: '#/components/parameters/ProjectIdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdateProjectRequest' }
 *     responses:
 *       200:
 *         description: Project updated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ProjectEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `projects:update` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       404:
 *         description: No project with this ID exists in the tenant.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       409:
 *         description: Project is ARCHIVED and therefore read-only.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       422:
 *         description: Validation failed (e.g. resulting dueDate before startDate).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.patch(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PROJECT_PERMISSIONS.UPDATE),
  validate({ params: projectIdParamSchema, body: updateProjectSchema }),
  ProjectController.update,
);

/**
 * @swagger
 * /projects/{id}/status:
 *   patch:
 *     tags: [Projects]
 *     summary: Transition a project's lifecycle status
 *     description: >
 *       Moves a project along its lifecycle state machine
 *       (DRAFT→PLANNED→ACTIVE⇄ON_HOLD→COMPLETED, COMPLETED→ACTIVE reopen, any
 *       non-terminal→CANCELLED). `reason` is required when moving to ON_HOLD
 *       or CANCELLED. ARCHIVED cannot be set here — use
 *       POST /projects/{id}/archive.
 *     security:
 *       - BearerAuth: []
 *     x-permission: projects:update
 *     parameters:
 *       - $ref: '#/components/parameters/ProjectIdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdateProjectStatusRequest' }
 *     responses:
 *       200:
 *         description: Status updated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ProjectEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `projects:update` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       404:
 *         description: No project with this ID exists in the tenant.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       409:
 *         description: Project is ARCHIVED, or the requested transition is not allowed from the current status.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       422:
 *         description: Validation failed (e.g. missing required reason for ON_HOLD/CANCELLED, or status is ARCHIVED).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.patch(
  '/:id/status',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PROJECT_PERMISSIONS.UPDATE),
  validate({ params: projectIdParamSchema, body: updateProjectStatusSchema }),
  ProjectController.updateStatus,
);

/**
 * @swagger
 * /projects/{id}/archive:
 *   post:
 *     tags: [Projects]
 *     summary: Archive a completed project
 *     description: >
 *       Moves a COMPLETED project to ARCHIVED and sets archivedAt. Once
 *       archived, the project (and its fields) becomes read-only. Only
 *       reachable from COMPLETED — use PATCH /projects/{id}/status first to
 *       reach COMPLETED.
 *     security:
 *       - BearerAuth: []
 *     x-permission: projects:manage
 *     parameters:
 *       - $ref: '#/components/parameters/ProjectIdParam'
 *     responses:
 *       200:
 *         description: Project archived.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ProjectEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `projects:manage` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       404:
 *         description: No project with this ID exists in the tenant.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       409:
 *         description: Project is not in COMPLETED status.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.post(
  '/:id/archive',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PROJECT_PERMISSIONS.MANAGE),
  validate({ params: projectIdParamSchema }),
  ProjectController.archive,
);

/**
 * @swagger
 * /projects/{id}/restore:
 *   post:
 *     tags: [Projects]
 *     summary: Restore a soft-deleted project
 *     description: >
 *       Reverses a soft delete (clears deletedAt/deletedBy). This is unrelated
 *       to the ARCHIVED lifecycle status — a project can be ARCHIVED without
 *       ever being deleted, and a deleted project keeps whatever status it
 *       had when deleted.
 *     security:
 *       - BearerAuth: []
 *     x-permission: projects:manage
 *     parameters:
 *       - $ref: '#/components/parameters/ProjectIdParam'
 *     responses:
 *       200:
 *         description: Project restored.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ProjectEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `projects:manage` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       404:
 *         description: No project with this ID exists in the tenant (including among deleted records).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       409:
 *         description: Project is not deleted.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.post(
  '/:id/restore',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PROJECT_PERMISSIONS.MANAGE),
  validate({ params: projectIdParamSchema }),
  ProjectController.restore,
);

/**
 * @swagger
 * /projects/{id}:
 *   delete:
 *     tags: [Projects]
 *     summary: Soft-delete a project
 *     description: >
 *       Soft-deletes a project (sets deletedAt/deletedBy) — reversible via
 *       POST /projects/{id}/restore. Only allowed while the project is
 *       DRAFT, PLANNED, or CANCELLED; in-flight, completed, or archived
 *       projects cannot be deleted.
 *     security:
 *       - BearerAuth: []
 *     x-permission: projects:delete
 *     parameters:
 *       - $ref: '#/components/parameters/ProjectIdParam'
 *     responses:
 *       200:
 *         description: Project deleted.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/DeleteEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `projects:delete` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       404:
 *         description: No project with this ID exists in the tenant.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       409:
 *         description: Project status is not DRAFT, PLANNED, or CANCELLED.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.delete(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PROJECT_PERMISSIONS.DELETE),
  validate({ params: projectIdParamSchema }),
  ProjectController.delete,
);

export default router;
