import { Router } from 'express';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { requirePermission } from '@middlewares/permission.middleware';
import { validate } from '@middlewares/validation.middleware';
import { TaskTemplateController } from '../controller/task-template.controller';
import { TASK_TEMPLATE_PERMISSIONS } from '../constants/task-template.permissions';
import { TASK_PERMISSIONS } from '../constants/task.permissions';
import {
  createTaskTemplateSchema,
  updateTaskTemplateSchema,
  instantiateTaskTemplateSchema,
  listTaskTemplatesQuerySchema,
  taskTemplateIdParamSchema,
} from '../schemas/task-template.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Task Template Routes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PRD §9 — reusable Task blueprints. Mounted flat at `/task-templates` (a
 * sibling of `/tasks`, not nested under it — simpler Express route ordering).
 * Every route runs: authMiddleware → tenantMiddleware → requirePermission →
 * validate → controller. Mirrors `modules/tasks/routes/task.routes.ts`.
 *
 * `POST /:id/instantiate` is gated by `TASK_PERMISSIONS.CREATE`, not a
 * template permission — it creates a real Task, so it's gated the same as
 * any other task-creation path (see `task-template.permissions.ts`'s header
 * comment).
 * ─────────────────────────────────────────────────────────────────────────────
 */
const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     TaskTemplate:
 *       type: object
 *       description: A task template response as returned by the API.
 *       properties:
 *         id: { type: string, format: uuid }
 *         name: { type: string, example: GST Filing }
 *         type: { $ref: '#/components/schemas/TaskType' }
 *         titleTemplate: { type: string }
 *         descriptionTemplate: { type: string, nullable: true }
 *         defaultPriority:
 *           allOf: [{ $ref: '#/components/schemas/TaskPriority' }]
 *           nullable: true
 *         dueInDays: { type: integer, nullable: true }
 *         isActive: { type: boolean }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *       required: [id, name, type, titleTemplate, isActive, createdAt, updatedAt]
 *     CreateTaskTemplateRequest:
 *       type: object
 *       required: [name, type, titleTemplate]
 *       properties:
 *         name: { type: string, minLength: 2, maxLength: 255 }
 *         type: { $ref: '#/components/schemas/TaskType' }
 *         titleTemplate: { type: string, minLength: 2, maxLength: 255 }
 *         descriptionTemplate: { type: string, maxLength: 5000 }
 *         defaultPriority: { $ref: '#/components/schemas/TaskPriority' }
 *         dueInDays: { type: integer, minimum: 0, maximum: 3650 }
 *     UpdateTaskTemplateRequest:
 *       type: object
 *       properties:
 *         name: { type: string, minLength: 2, maxLength: 255 }
 *         type: { $ref: '#/components/schemas/TaskType' }
 *         titleTemplate: { type: string, minLength: 2, maxLength: 255 }
 *         descriptionTemplate: { type: string, maxLength: 5000, nullable: true }
 *         defaultPriority:
 *           allOf: [{ $ref: '#/components/schemas/TaskPriority' }]
 *           nullable: true
 *         dueInDays: { type: integer, minimum: 0, maximum: 3650, nullable: true }
 *         isActive: { type: boolean }
 *     InstantiateTaskTemplateRequest:
 *       type: object
 *       description: All fields optional — override the template's defaults, or fall back to them.
 *       properties:
 *         title: { type: string, minLength: 2, maxLength: 255 }
 *         description: { type: string, maxLength: 5000 }
 *         priority: { $ref: '#/components/schemas/TaskPriority' }
 *         dueDate: { type: string, format: date-time }
 *         projectId: { type: string, format: uuid }
 *         leadId: { type: string, format: uuid }
 *         assigneeId: { type: string, format: uuid }
 *         businessId: { type: string, format: uuid }
 *         contactId: { type: string, format: uuid }
 *         clientId: { type: string, format: uuid }
 *     TaskTemplateEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Success }
 *         data: { $ref: '#/components/schemas/TaskTemplate' }
 *         timestamp: { type: string, format: date-time }
 *         correlationId: { type: string, format: uuid }
 *     TaskTemplateListEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Fetched successfully }
 *         data:
 *           type: array
 *           items: { $ref: '#/components/schemas/TaskTemplate' }
 *         meta: { $ref: '#/components/schemas/PaginationMeta' }
 *         timestamp: { type: string, format: date-time }
 *         correlationId: { type: string, format: uuid }
 *   parameters:
 *     TaskTemplateIdParam:
 *       name: id
 *       in: path
 *       required: true
 *       schema: { type: string, format: uuid }
 *       description: Task template ID.
 */

/**
 * @swagger
 * /task-templates:
 *   post:
 *     tags: [Task Templates]
 *     summary: Create a task template
 *     security:
 *       - BearerAuth: []
 *     x-permission: task_templates:create
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateTaskTemplateRequest' }
 *     responses:
 *       201:
 *         description: Template created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TaskTemplateEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `task_templates:create` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       422:
 *         description: Validation failed.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.post(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(TASK_TEMPLATE_PERMISSIONS.CREATE),
  validate({ body: createTaskTemplateSchema }),
  TaskTemplateController.create,
);

/**
 * @swagger
 * /task-templates:
 *   get:
 *     tags: [Task Templates]
 *     summary: List task templates
 *     description: Paginated, filterable, searchable list of task templates scoped to the current tenant.
 *     security:
 *       - BearerAuth: []
 *     x-permission: task_templates:read
 *     parameters:
 *       - name: page
 *         in: query
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - name: search
 *         in: query
 *         schema: { type: string, maxLength: 100 }
 *       - name: type
 *         in: query
 *         schema: { $ref: '#/components/schemas/TaskType' }
 *       - name: isActive
 *         in: query
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Paginated list of templates.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TaskTemplateListEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `task_templates:read` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.get(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(TASK_TEMPLATE_PERMISSIONS.READ),
  validate({ query: listTaskTemplatesQuerySchema }),
  TaskTemplateController.list,
);

/**
 * @swagger
 * /task-templates/{id}:
 *   get:
 *     tags: [Task Templates]
 *     summary: Get a task template by ID
 *     security:
 *       - BearerAuth: []
 *     x-permission: task_templates:read
 *     parameters:
 *       - $ref: '#/components/parameters/TaskTemplateIdParam'
 *     responses:
 *       200:
 *         description: Template found.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TaskTemplateEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `task_templates:read` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       404:
 *         description: No template with this ID exists in the tenant.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.get(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(TASK_TEMPLATE_PERMISSIONS.READ),
  validate({ params: taskTemplateIdParamSchema }),
  TaskTemplateController.getById,
);

/**
 * @swagger
 * /task-templates/{id}:
 *   patch:
 *     tags: [Task Templates]
 *     summary: Update a task template
 *     security:
 *       - BearerAuth: []
 *     x-permission: task_templates:update
 *     parameters:
 *       - $ref: '#/components/parameters/TaskTemplateIdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdateTaskTemplateRequest' }
 *     responses:
 *       200:
 *         description: Template updated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TaskTemplateEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `task_templates:update` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       404:
 *         description: No template with this ID exists in the tenant.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       422:
 *         description: Validation failed.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.patch(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(TASK_TEMPLATE_PERMISSIONS.UPDATE),
  validate({ params: taskTemplateIdParamSchema, body: updateTaskTemplateSchema }),
  TaskTemplateController.update,
);

/**
 * @swagger
 * /task-templates/{id}:
 *   delete:
 *     tags: [Task Templates]
 *     summary: Soft-delete a task template
 *     security:
 *       - BearerAuth: []
 *     x-permission: task_templates:delete
 *     parameters:
 *       - $ref: '#/components/parameters/TaskTemplateIdParam'
 *     responses:
 *       200:
 *         description: Template deleted.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/DeleteEnvelope' }
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       403:
 *         description: Caller lacks the `task_templates:delete` permission.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       404:
 *         description: No template with this ID exists in the tenant.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.delete(
  '/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(TASK_TEMPLATE_PERMISSIONS.DELETE),
  validate({ params: taskTemplateIdParamSchema }),
  TaskTemplateController.delete,
);

/**
 * @swagger
 * /task-templates/{id}/instantiate:
 *   post:
 *     tags: [Task Templates]
 *     summary: Create a real Task from this template
 *     description: >
 *       PRD §9 — delegates to the same task-creation path as POST /tasks, so
 *       the resulting Task gets identical notification/audit handling. Every
 *       field is optional and overrides the template's own default.
 *     security:
 *       - BearerAuth: []
 *     x-permission: tasks:create
 *     parameters:
 *       - $ref: '#/components/parameters/TaskTemplateIdParam'
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/InstantiateTaskTemplateRequest' }
 *     responses:
 *       201:
 *         description: Task created from the template.
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
 *         description: No template with this ID exists in the tenant.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 *       409:
 *         description: Template is inactive.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiErrorResponse' }
 */
router.post(
  '/:id/instantiate',
  authMiddleware,
  tenantMiddleware,
  requirePermission(TASK_PERMISSIONS.CREATE),
  validate({ params: taskTemplateIdParamSchema, body: instantiateTaskTemplateSchema }),
  TaskTemplateController.instantiate,
);

export default router;
