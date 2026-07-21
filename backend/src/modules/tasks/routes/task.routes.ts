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
  listTasksQuerySchema,
  taskIdParamSchema,
  projectIdParamSchema,
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
 *       enum: [TODO, IN_PROGRESS, REVIEW, COMPLETED, CANCELLED]
 *       description: >
 *         Lifecycle status. Valid transitions: TODO→IN_PROGRESS→REVIEW⇄IN_PROGRESS→COMPLETED,
 *         COMPLETED→IN_PROGRESS (reopen), any non-terminal→CANCELLED (terminal).
 *         There is no ARCHIVED status for tasks.
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
 *         projectId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         assigneeId:
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
 *         isOverdue:
 *           type: boolean
 *           description: Computed — true if dueDate has passed and status is not COMPLETED/CANCELLED.
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
 *         assigneeId:
 *           type: string
 *           format: uuid
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
 *         assigneeId:
 *           type: string
 *           format: uuid
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
 *           description: Required when moving to CANCELLED.
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
 *       Moves a task along its lifecycle state machine
 *       (TODO→IN_PROGRESS→REVIEW⇄IN_PROGRESS→COMPLETED, COMPLETED→IN_PROGRESS
 *       reopen, any non-terminal→CANCELLED). `reason` is required when moving
 *       to CANCELLED. There is no ARCHIVED status for tasks.
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
