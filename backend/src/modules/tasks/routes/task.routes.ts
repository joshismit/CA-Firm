import { Router } from 'express';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { requirePermission } from '@middlewares/permission.middleware';
import { validate } from '@middlewares/validation.middleware';
import { TaskController } from '../controller/task.controller';
import { TASK_PERMISSIONS } from '../constants/task.permissions';
import {
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
  assignTaskSchema,
  rejectTaskSchema,
  listTasksQuerySchema,
  assignableStaffQuerySchema,
  taskIdParamSchema,
  projectIdParamSchema,
  leadIdParamSchema,
  assigneeIdParamSchema,
} from '../schemas/task.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Task Routes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every route runs: authMiddleware → tenantMiddleware → requirePermission →
 * validate → controller. Mirrors `modules/projects/routes/project.routes.ts`.
 *
 * `authMiddleware` only decodes the JWT onto `req.user`. `BaseService` (which
 * `TaskService` extends) reads `req.tenant.id` — populated by
 * `tenantMiddleware`, not `authMiddleware` — so both must run on every route
 * or every repository call fails its tenant-isolation guard.
 *
 * Static-segment routes (`/overdue`, `/project/:projectId`,
 * `/assignee/:assigneeId`) are registered before `/:id` — Express matches
 * routes in registration order, and `/:id` would otherwise swallow those
 * paths.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     TaskStatus:
 *       type: string
 *       enum: [TODO, IN_PROGRESS, REVIEW, COMPLETED, CANCELLED, REQUESTED, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED]
 *       description: >
 *         Lifecycle status. Two independent families sharing one enum (PRD §9) — see TaskType.
 *         Simple flow: TODO→IN_PROGRESS→REVIEW⇄IN_PROGRESS→COMPLETED, COMPLETED→IN_PROGRESS (reopen),
 *         any non-terminal→CANCELLED (terminal).
 *         Approval workflow: REQUESTED→SUBMITTED→(UNDER_REVIEW→)APPROVED→COMPLETED,
 *         SUBMITTED/UNDER_REVIEW→REJECTED, REJECTED→REQUESTED (reopen/resubmit),
 *         REQUESTED/SUBMITTED/UNDER_REVIEW→CANCELLED.
 *         There is no ARCHIVED status for tasks.
 *     TaskType:
 *       type: string
 *       enum: [DOCUMENT_REQUEST, FILING, COMPLIANCE, PAYMENT_FOLLOW_UP, DOCUMENT_REVIEW, APPROVAL]
 *       description: PRD §9 — a task created WITH a type starts REQUESTED and follows the approval workflow; omitted, it starts TODO and follows the simple flow.
 *     TaskPriority:
 *       type: string
 *       enum: [LOW, MEDIUM, HIGH, URGENT]
 *     Task:
 *       type: object
 *       description: A task response as returned by the API — never the raw database row.
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         title:
 *           type: string
 *           example: Prepare draft financials
 *         description:
 *           type: string
 *           nullable: true
 *         status:
 *           $ref: '#/components/schemas/TaskStatus'
 *         type:
 *           allOf: [{ $ref: '#/components/schemas/TaskType' }]
 *           nullable: true
 *         priority:
 *           allOf: [{ $ref: '#/components/schemas/TaskPriority' }]
 *           nullable: true
 *         projectId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         leadId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           description: PRD §8.7 — links this task to a CRM Lead as a follow-up.
 *         assigneeId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         businessId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         contactId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         clientId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         documentId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         folderId:
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
 *         completedBy:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         approvedBy:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         rejectedBy:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         isOverdue:
 *           type: boolean
 *           description: Computed — true if dueDate has passed and status is not a terminal status.
 *         isCompleted:
 *           type: boolean
 *           description: Computed — true if status is COMPLETED.
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       required: [id, title, status, isOverdue, isCompleted, createdAt, updatedAt]
 *     CreateTaskRequest:
 *       type: object
 *       required: [title]
 *       properties:
 *         projectId:
 *           type: string
 *           format: uuid
 *           description: Omit to create a standalone task.
 *         leadId:
 *           type: string
 *           format: uuid
 *           description: PRD §8.7 — omit unless this task is a CRM follow-up for a Lead.
 *         assigneeId:
 *           type: string
 *           format: uuid
 *         businessId:
 *           type: string
 *           format: uuid
 *         contactId:
 *           type: string
 *           format: uuid
 *         clientId:
 *           type: string
 *           format: uuid
 *         documentId:
 *           type: string
 *           format: uuid
 *         folderId:
 *           type: string
 *           format: uuid
 *         type:
 *           $ref: '#/components/schemas/TaskType'
 *         priority:
 *           $ref: '#/components/schemas/TaskPriority'
 *         title:
 *           type: string
 *           minLength: 2
 *           maxLength: 255
 *           example: Prepare draft financials
 *         description:
 *           type: string
 *           maxLength: 5000
 *         startDate:
 *           type: string
 *           format: date-time
 *         dueDate:
 *           type: string
 *           format: date-time
 *     UpdateTaskRequest:
 *       type: object
 *       description: Partial update. Unlike Project's clientId, projectId may be changed here (or cleared) to move/detach a task.
 *       properties:
 *         projectId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         leadId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         assigneeId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         businessId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         contactId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         clientId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         documentId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         folderId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         type:
 *           allOf: [{ $ref: '#/components/schemas/TaskType' }]
 *           nullable: true
 *         priority:
 *           allOf: [{ $ref: '#/components/schemas/TaskPriority' }]
 *           nullable: true
 *         title:
 *           type: string
 *           minLength: 2
 *           maxLength: 255
 *         description:
 *           type: string
 *           maxLength: 5000
 *           nullable: true
 *         startDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         dueDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *     UpdateTaskStatusRequest:
 *       type: object
 *       required: [status]
 *       properties:
 *         status:
 *           $ref: '#/components/schemas/TaskStatus'
 *         reason:
 *           type: string
 *           minLength: 3
 *           maxLength: 500
 *           description: Required when moving to CANCELLED or REJECTED.
 *     TaskEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Success }
 *         data: { $ref: '#/components/schemas/Task' }
 *         timestamp: { type: string, format: date-time }
 *         correlationId: { type: string, format: uuid }
 *         durationMs: { type: number }
 *     TaskListEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Fetched successfully }
 *         data:
 *           type: array
 *           items: { $ref: '#/components/schemas/Task' }
 *         meta: { $ref: '#/components/schemas/PaginationMeta' }
 *         timestamp: { type: string, format: date-time }
 *         correlationId: { type: string, format: uuid }
 *     TaskArrayEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Fetched successfully }
 *         data:
 *           type: array
 *           items: { $ref: '#/components/schemas/Task' }
 *         timestamp: { type: string, format: date-time }
 *         correlationId: { type: string, format: uuid }
 *   parameters:
 *     TaskIdParam:
 *       name: id
 *       in: path
 *       required: true
 *       schema: { type: string, format: uuid }
 *       description: Task ID.
 * # Note: PaginationMeta, DeleteEnvelope, and ApiErrorResponse are already
 * # registered by modules/projects/routes/project.routes.ts and are reused
 * # here by $ref — swagger-jsdoc merges every scanned file's `components`
 * # into one spec, so redefining identical shared envelopes here would be
 * # pure duplication.
 */

// ─── Static-segment routes (must precede /:id) ───────────────────────────────

/**
 * @swagger
 * /tasks:
 *   post:
 *     tags: [Tasks]
 *     summary: Create a task
 *     description: Creates a new task in TODO status. projectId is optional — omit it to create a standalone task.
 *     security:
 *       - BearerAuth: []
 *     x-permission: tasks:create
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateTaskRequest' }
 *     responses:
 *       201:
 *         description: Task created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TaskEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `tasks:create` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       404:
 *         description: Referenced projectId or assigneeId does not exist.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       422:
 *         description: Validation failed (e.g. dueDate before startDate).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.post(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(TASK_PERMISSIONS.CREATE),
  validate({ body: createTaskSchema }),
  TaskController.create,
);

/**
 * @swagger
 * /tasks:
 *   get:
 *     tags: [Tasks]
 *     summary: List tasks
 *     description: Paginated, filterable, searchable list of tasks scoped to the current tenant.
 *     security:
 *       - BearerAuth: []
 *     x-permission: tasks:read
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
 *         description: Case-insensitive match against task title or description.
 *         schema: { type: string, maxLength: 100 }
 *       - name: status
 *         in: query
 *         schema: { $ref: '#/components/schemas/TaskStatus' }
 *       - name: projectId
 *         in: query
 *         schema: { type: string, format: uuid }
 *       - name: leadId
 *         in: query
 *         schema: { type: string, format: uuid }
 *       - name: assigneeId
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
 *         description: Paginated list of tasks.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TaskListEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `tasks:read` permission.
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
  requirePermission(TASK_PERMISSIONS.READ),
  validate({ query: listTasksQuerySchema }),
  TaskController.list,
);

/**
 * @swagger
 * /tasks/overdue:
 *   get:
 *     tags: [Tasks]
 *     summary: List overdue tasks
 *     description: Returns all open (not COMPLETED/CANCELLED) tasks whose dueDate has passed, ordered by dueDate ascending.
 *     security:
 *       - BearerAuth: []
 *     x-permission: tasks:read
 *     responses:
 *       200:
 *         description: Overdue tasks.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TaskArrayEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `tasks:read` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.get(
  '/overdue',
  authMiddleware,
  tenantMiddleware,
  requirePermission(TASK_PERMISSIONS.READ),
  TaskController.getOverdue,
);

/**
 * @swagger
 * /tasks/assignable-staff:
 *   get:
 *     tags: [Tasks]
 *     summary: List staff eligible for task assignment
 *     description: >
 *       Returns the staff a caller may assign a task to. Sourced from
 *       BusinessAssignment for the given/resolved Business, falling back to
 *       all active tenant staff when that Business has no assignments yet.
 *       A CLIENT caller's own Business is always used — businessId/clientId
 *       query params are ignored for them. Gated on tasks:create (not
 *       tasks:read) since the only reason to call this is to populate a
 *       picker while creating/assigning a task.
 *     security:
 *       - BearerAuth: []
 *     x-permission: tasks:create
 *     parameters:
 *       - name: businessId
 *         in: query
 *         schema: { type: string, format: uuid }
 *       - name: clientId
 *         in: query
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Eligible staff (id, firstName, lastName, email only).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Fetched successfully }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       firstName: { type: string }
 *                       lastName: { type: string, nullable: true }
 *                       email: { type: string }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `tasks:create` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.get(
  '/assignable-staff',
  authMiddleware,
  tenantMiddleware,
  requirePermission(TASK_PERMISSIONS.CREATE),
  validate({ query: assignableStaffQuerySchema }),
  TaskController.getAssignableStaff,
);

/**
 * @swagger
 * /tasks/pending-review:
 *   get:
 *     tags: [Tasks]
 *     summary: List tasks awaiting review
 *     description: PRD §9 — returns approval-workflow tasks in SUBMITTED or UNDER_REVIEW status, ordered by dueDate ascending.
 *     security:
 *       - BearerAuth: []
 *     x-permission: tasks:review
 *     responses:
 *       200:
 *         description: Tasks pending review.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TaskArrayEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `tasks:review` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.get(
  '/pending-review',
  authMiddleware,
  tenantMiddleware,
  requirePermission(TASK_PERMISSIONS.REVIEW),
  TaskController.getPendingReview,
);

/**
 * @swagger
 * /tasks/project/{projectId}:
 *   get:
 *     tags: [Tasks]
 *     summary: List a project's tasks
 *     description: Returns every task belonging to the given project, newest first. Returns an empty array if the project has no tasks.
 *     security:
 *       - BearerAuth: []
 *     x-permission: tasks:read
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Project's tasks.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TaskArrayEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `tasks:read` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       422:
 *         description: projectId is not a valid UUID.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.get(
  '/project/:projectId',
  authMiddleware,
  tenantMiddleware,
  requirePermission(TASK_PERMISSIONS.READ),
  validate({ params: projectIdParamSchema }),
  TaskController.getByProject,
);

/**
 * @swagger
 * /tasks/lead/{leadId}:
 *   get:
 *     tags: [Tasks]
 *     summary: List a lead's follow-up tasks
 *     description: >
 *       PRD §8.7 — returns every task linked to the given CRM Lead (via
 *       Task.leadId), newest first. Returns an empty array if the lead has no
 *       follow-up tasks.
 *     security:
 *       - BearerAuth: []
 *     x-permission: tasks:read
 *     parameters:
 *       - name: leadId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Lead's follow-up tasks.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TaskArrayEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `tasks:read` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       422:
 *         description: leadId is not a valid UUID.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.get(
  '/lead/:leadId',
  authMiddleware,
  tenantMiddleware,
  requirePermission(TASK_PERMISSIONS.READ),
  validate({ params: leadIdParamSchema }),
  TaskController.getByLead,
);

/**
 * @swagger
 * /tasks/assignee/{assigneeId}:
 *   get:
 *     tags: [Tasks]
 *     summary: List an assignee's tasks
 *     description: Returns every task assigned to the given user, newest first. Returns an empty array if the user has no assigned tasks.
 *     security:
 *       - BearerAuth: []
 *     x-permission: tasks:read
 *     parameters:
 *       - name: assigneeId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Assignee's tasks.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TaskArrayEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `tasks:read` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       422:
 *         description: assigneeId is not a valid UUID.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.get(
  '/assignee/:assigneeId',
  authMiddleware,
  tenantMiddleware,
  requirePermission(TASK_PERMISSIONS.READ),
  validate({ params: assigneeIdParamSchema }),
  TaskController.getByAssignee,
);

// ─── /:id routes ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /tasks/{id}:
 *   get:
 *     tags: [Tasks]
 *     summary: Get a task by ID
 *     security:
 *       - BearerAuth: []
 *     x-permission: tasks:read
 *     parameters:
 *       - $ref: '#/components/parameters/TaskIdParam'
 *     responses:
 *       200:
 *         description: Task found.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TaskEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `tasks:read` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       404:
 *         description: No task with this ID exists in the tenant.
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
  requirePermission(TASK_PERMISSIONS.READ),
  validate({ params: taskIdParamSchema }),
  TaskController.getById,
);

/**
 * @swagger
 * /tasks/{id}:
 *   patch:
 *     tags: [Tasks]
 *     summary: Update a task
 *     description: Partial update of mutable task fields. Unlike Project's clientId, projectId may be changed (or cleared) here.
 *     security:
 *       - BearerAuth: []
 *     x-permission: tasks:update
 *     parameters:
 *       - $ref: '#/components/parameters/TaskIdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdateTaskRequest' }
 *     responses:
 *       200:
 *         description: Task updated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TaskEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `tasks:update` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       404:
 *         description: No task with this ID exists in the tenant.
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
  requirePermission(TASK_PERMISSIONS.UPDATE),
  validate({ params: taskIdParamSchema, body: updateTaskSchema }),
  TaskController.update,
);

/**
 * @swagger
 * /tasks/{id}/status:
 *   patch:
 *     tags: [Tasks]
 *     summary: Transition a task's lifecycle status
 *     description: >
 *       Moves a task along its lifecycle state machine — see the TaskStatus
 *       schema for the full simple-flow/approval-workflow transition map.
 *       `reason` is required when moving to CANCELLED or REJECTED. Dedicated
 *       action endpoints (POST /tasks/{id}/submit|approve|reject|complete|reopen)
 *       are also available and preferred for the approval workflow. There is
 *       no ARCHIVED status for tasks.
 *     security:
 *       - BearerAuth: []
 *     x-permission: tasks:update
 *     parameters:
 *       - $ref: '#/components/parameters/TaskIdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdateTaskStatusRequest' }
 *     responses:
 *       200:
 *         description: Status updated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TaskEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `tasks:update` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       404:
 *         description: No task with this ID exists in the tenant.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       409:
 *         description: The requested transition is not allowed from the current status.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       422:
 *         description: Validation failed (e.g. missing required reason for CANCELLED).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.patch(
  '/:id/status',
  authMiddleware,
  tenantMiddleware,
  requirePermission(TASK_PERMISSIONS.UPDATE),
  validate({ params: taskIdParamSchema, body: updateTaskStatusSchema }),
  TaskController.updateStatus,
);

/**
 * @swagger
 * /tasks/{id}/assign:
 *   post:
 *     tags: [Tasks]
 *     summary: Assign or reassign a task
 *     description: PRD §9 — thin, narrowly-permissioned alternative to PATCH /tasks/{id} for reassignment.
 *     security:
 *       - BearerAuth: []
 *     x-permission: tasks:assign
 *     parameters:
 *       - $ref: '#/components/parameters/TaskIdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [assigneeId]
 *             properties:
 *               assigneeId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Task reassigned.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TaskEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `tasks:assign` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       404:
 *         description: No task with this ID exists in the tenant.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.post(
  '/:id/assign',
  authMiddleware,
  tenantMiddleware,
  requirePermission(TASK_PERMISSIONS.ASSIGN),
  validate({ params: taskIdParamSchema, body: assignTaskSchema }),
  TaskController.assign,
);

/**
 * @swagger
 * /tasks/{id}/submit:
 *   post:
 *     tags: [Tasks]
 *     summary: Submit a task for review
 *     description: PRD §9 — approval workflow REQUESTED → SUBMITTED.
 *     security:
 *       - BearerAuth: []
 *     x-permission: tasks:update
 *     parameters:
 *       - $ref: '#/components/parameters/TaskIdParam'
 *     responses:
 *       200:
 *         description: Task submitted.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TaskEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `tasks:update` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       404:
 *         description: No task with this ID exists in the tenant.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       409:
 *         description: Task is not in REQUESTED status.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.post(
  '/:id/submit',
  authMiddleware,
  tenantMiddleware,
  requirePermission(TASK_PERMISSIONS.UPDATE),
  validate({ params: taskIdParamSchema }),
  TaskController.submit,
);

/**
 * @swagger
 * /tasks/{id}/approve:
 *   post:
 *     tags: [Tasks]
 *     summary: Approve a task
 *     description: PRD §9 — approval workflow (SUBMITTED|UNDER_REVIEW) → APPROVED.
 *     security:
 *       - BearerAuth: []
 *     x-permission: tasks:approve
 *     parameters:
 *       - $ref: '#/components/parameters/TaskIdParam'
 *     responses:
 *       200:
 *         description: Task approved.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TaskEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `tasks:approve` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       404:
 *         description: No task with this ID exists in the tenant.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       409:
 *         description: Task is not in SUBMITTED or UNDER_REVIEW status.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.post(
  '/:id/approve',
  authMiddleware,
  tenantMiddleware,
  requirePermission(TASK_PERMISSIONS.APPROVE),
  validate({ params: taskIdParamSchema }),
  TaskController.approve,
);

/**
 * @swagger
 * /tasks/{id}/reject:
 *   post:
 *     tags: [Tasks]
 *     summary: Reject a task
 *     description: PRD §9 — approval workflow (SUBMITTED|UNDER_REVIEW) → REJECTED. A reason is required.
 *     security:
 *       - BearerAuth: []
 *     x-permission: tasks:review
 *     parameters:
 *       - $ref: '#/components/parameters/TaskIdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason: { type: string, minLength: 3, maxLength: 500 }
 *     responses:
 *       200:
 *         description: Task rejected.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TaskEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `tasks:review` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       404:
 *         description: No task with this ID exists in the tenant.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       409:
 *         description: Task is not in SUBMITTED or UNDER_REVIEW status.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       422:
 *         description: Missing or too-short reason.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.post(
  '/:id/reject',
  authMiddleware,
  tenantMiddleware,
  requirePermission(TASK_PERMISSIONS.REVIEW),
  validate({ params: taskIdParamSchema, body: rejectTaskSchema }),
  TaskController.reject,
);

/**
 * @swagger
 * /tasks/{id}/complete:
 *   post:
 *     tags: [Tasks]
 *     summary: Complete a task
 *     description: PRD §9 — REVIEW → COMPLETED (simple flow) or APPROVED → COMPLETED (approval workflow).
 *     security:
 *       - BearerAuth: []
 *     x-permission: tasks:complete
 *     parameters:
 *       - $ref: '#/components/parameters/TaskIdParam'
 *     responses:
 *       200:
 *         description: Task completed.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TaskEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `tasks:complete` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       404:
 *         description: No task with this ID exists in the tenant.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       409:
 *         description: Task is not in REVIEW or APPROVED status.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.post(
  '/:id/complete',
  authMiddleware,
  tenantMiddleware,
  requirePermission(TASK_PERMISSIONS.COMPLETE),
  validate({ params: taskIdParamSchema }),
  TaskController.complete,
);

/**
 * @swagger
 * /tasks/{id}/reopen:
 *   post:
 *     tags: [Tasks]
 *     summary: Reopen a completed or rejected task
 *     description: PRD §9 — COMPLETED → IN_PROGRESS or REJECTED → REQUESTED.
 *     security:
 *       - BearerAuth: []
 *     x-permission: tasks:update
 *     parameters:
 *       - $ref: '#/components/parameters/TaskIdParam'
 *     responses:
 *       200:
 *         description: Task reopened.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TaskEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `tasks:update` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       404:
 *         description: No task with this ID exists in the tenant.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       409:
 *         description: Task is not in COMPLETED or REJECTED status.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.post(
  '/:id/reopen',
  authMiddleware,
  tenantMiddleware,
  requirePermission(TASK_PERMISSIONS.UPDATE),
  validate({ params: taskIdParamSchema }),
  TaskController.reopen,
);

/**
 * @swagger
 * /tasks/{id}/restore:
 *   patch:
 *     tags: [Tasks]
 *     summary: Restore a soft-deleted task
 *     description: Reverses a soft delete (clears deletedAt/deletedBy).
 *     security:
 *       - BearerAuth: []
 *     x-permission: tasks:manage
 *     parameters:
 *       - $ref: '#/components/parameters/TaskIdParam'
 *     responses:
 *       200:
 *         description: Task restored.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TaskEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `tasks:manage` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       404:
 *         description: No task with this ID exists in the tenant (including among deleted records).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       409:
 *         description: Task is not deleted.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.patch(
  '/:id/restore',
  authMiddleware,
  tenantMiddleware,
  requirePermission(TASK_PERMISSIONS.MANAGE),
  validate({ params: taskIdParamSchema }),
  TaskController.restore,
);

/**
 * @swagger
 * /tasks/{id}:
 *   delete:
 *     tags: [Tasks]
 *     summary: Soft-delete a task
 *     description: >
 *       Soft-deletes a task (sets deletedAt/deletedBy) — reversible via
 *       PATCH /tasks/{id}/restore. Only allowed while the task is TODO or
 *       CANCELLED.
 *     security:
 *       - BearerAuth: []
 *     x-permission: tasks:delete
 *     parameters:
 *       - $ref: '#/components/parameters/TaskIdParam'
 *     responses:
 *       200:
 *         description: Task deleted.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/DeleteEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `tasks:delete` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       404:
 *         description: No task with this ID exists in the tenant.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       409:
 *         description: Task status is not TODO or CANCELLED.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.delete(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(TASK_PERMISSIONS.DELETE),
  validate({ params: taskIdParamSchema }),
  TaskController.delete,
);

export default router;
