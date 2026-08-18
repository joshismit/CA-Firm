import { Router } from 'express';
import { authMiddleware } from '@middlewares/auth.middleware';
import { requireRole } from '@middlewares/permission.middleware';
import { validate } from '@middlewares/validation.middleware';
import { masterAdminAuthRateLimiter } from '@middlewares/rate-limit.middleware';
import { UserRole } from '@shared/enums';
import { MasterAdminAuthController } from '../controller/master-admin-auth.controller';
import { TenantController } from '../controller/tenant.controller';
import { MasterAdminAuditController } from '../controller/master-admin-audit.controller';
import {
  masterAdminLoginSchema,
  listTenantsQuerySchema,
  tenantIdParamSchema,
  updateTenantStatusSchema,
  updateTenantLimitsSchema,
  createTenantSchema,
  listMasterAdminAuditLogsQuerySchema,
  auditLogIdParamSchema,
} from '../schemas/master-admin.schema';
import { PlanController, createPlanSchema, updatePlanSchema, planIdParamSchema } from '@modules/billing';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Master Admin Routes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `/auth/login` is the only public route here — every other route runs
 * `authMiddleware → requireRole(MASTER_ADMIN) → validate → controller`.
 * Deliberately no `tenantMiddleware` anywhere in this file: a master admin
 * isn't scoped to a tenant, so there is no `req.tenant` to resolve (see
 * `MasterAdmin`'s header comment in schema.prisma), and deliberately no
 * `requirePermission()` — `req.user.permissions` is always `[]` for a master
 * admin token (see `MasterAdminAuthService.login()`); `requireRole` is the
 * correct, coarser gate for this whole portal, mirroring the frontend's own
 * structural `role !== 'MASTER_ADMIN'` guard in `routes/master-admin.routes.tsx`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const router = Router();

/**
 * @swagger
 * /master-admin/auth/login:
 *   post:
 *     tags: [Master Admin]
 *     summary: Log in to the platform admin panel
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200: { description: Logged in., content: { application/json: { schema: { type: object } } } }
 *       401: { description: Invalid email or password., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Account is inactive., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.post('/auth/login', masterAdminAuthRateLimiter, validate({ body: masterAdminLoginSchema }), MasterAdminAuthController.login);

/**
 * @swagger
 * /master-admin/tenants:
 *   post:
 *     tags: [Master Admin]
 *     summary: Create a tenant and invite its owner
 *     description: Creates the tenant, its settings, and a full-access "Owner" role, then emails the owner a bootstrap invitation (same accept flow as a staff invite).
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, ownerFirstName, ownerLastName, ownerEmail]
 *             properties:
 *               name: { type: string, maxLength: 255 }
 *               slug: { type: string, description: Auto-derived from name if omitted. }
 *               country: { type: string, minLength: 2, maxLength: 2 }
 *               timezone: { type: string }
 *               locale: { type: string }
 *               defaultCurrency: { type: string, minLength: 3, maxLength: 3 }
 *               planCode: { type: string }
 *               ownerFirstName: { type: string, maxLength: 100 }
 *               ownerLastName: { type: string, maxLength: 100 }
 *               ownerEmail: { type: string, format: email }
 *     responses:
 *       201: { description: Tenant created and owner invited., content: { application/json: { schema: { type: object } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller is not a master admin., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       409: { description: A tenant with this slug already exists., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.post(
  '/tenants',
  authMiddleware,
  requireRole(UserRole.MASTER_ADMIN),
  validate({ body: createTenantSchema }),
  TenantController.create,
);

/**
 * @swagger
 * /master-admin/tenants:
 *   get:
 *     tags: [Master Admin]
 *     summary: List every tenant on the platform
 *     description: Paginated, filterable, searchable list of tenants.
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - name: page
 *         in: query
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - name: search
 *         in: query
 *         description: Case-insensitive match against tenant name or slug.
 *         schema: { type: string, maxLength: 100 }
 *       - name: status
 *         in: query
 *         schema: { type: string, enum: [ACTIVE, TRIAL, SUSPENDED, DEACTIVATED] }
 *     responses:
 *       200: { description: Paginated list of tenants., content: { application/json: { schema: { type: object } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller is not a master admin., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.get(
  '/tenants',
  authMiddleware,
  requireRole(UserRole.MASTER_ADMIN),
  validate({ query: listTenantsQuerySchema }),
  TenantController.list,
);

/**
 * @swagger
 * /master-admin/tenants/{id}:
 *   get:
 *     tags: [Master Admin]
 *     summary: Get one tenant, including its resource usage
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Tenant found., content: { application/json: { schema: { type: object } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller is not a master admin., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No tenant with this ID exists., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.get(
  '/tenants/:id',
  authMiddleware,
  requireRole(UserRole.MASTER_ADMIN),
  validate({ params: tenantIdParamSchema }),
  TenantController.getById,
);

/**
 * @swagger
 * /master-admin/tenants/{id}/status:
 *   patch:
 *     tags: [Master Admin]
 *     summary: Activate, suspend, or deactivate a tenant
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [ACTIVE, TRIAL, SUSPENDED, DEACTIVATED] }
 *     responses:
 *       200: { description: Tenant status updated., content: { application/json: { schema: { type: object } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller is not a master admin., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No tenant with this ID exists., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.patch(
  '/tenants/:id/status',
  authMiddleware,
  requireRole(UserRole.MASTER_ADMIN),
  validate({ params: tenantIdParamSchema, body: updateTenantStatusSchema }),
  TenantController.updateStatus,
);

/**
 * @swagger
 * /master-admin/tenants/{id}/limits:
 *   patch:
 *     tags: [Master Admin]
 *     summary: Change a tenant's plan code and usage limits
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               planCode: { type: string, nullable: true }
 *               subscriptionStatus: { type: string, enum: [TRIAL, ACTIVE, PAST_DUE, SUSPENDED, CANCELLED, EXPIRED] }
 *               subscriptionExpiresAt: { type: string, format: date-time, nullable: true }
 *               maxUsers: { type: integer, nullable: true }
 *               maxClients: { type: integer, nullable: true }
 *               maxStorageGb: { type: integer, nullable: true }
 *               maxDocuments: { type: integer, nullable: true }
 *               maxUploadSizeMb: { type: integer, nullable: true, description: 'PRD §7.4 — per-file upload size ceiling in MB.' }
 *     responses:
 *       200: { description: Tenant limits updated., content: { application/json: { schema: { type: object } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller is not a master admin., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No tenant with this ID exists., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.patch(
  '/tenants/:id/limits',
  authMiddleware,
  requireRole(UserRole.MASTER_ADMIN),
  validate({ params: tenantIdParamSchema, body: updateTenantLimitsSchema }),
  TenantController.updateLimits,
);

/**
 * @swagger
 * /master-admin/tenants/{id}/users:
 *   get:
 *     tags: [Master Admin]
 *     summary: List a tenant's users
 *     description: Minimal id/name/email rows for this tenant — backs the master-admin audit log's "User" filter selector (PRD §4.1).
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Every user in this tenant (up to 200)., content: { application/json: { schema: { type: object } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller is not a master admin., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No tenant with this ID exists., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.get(
  '/tenants/:id/users',
  authMiddleware,
  requireRole(UserRole.MASTER_ADMIN),
  validate({ params: tenantIdParamSchema }),
  TenantController.listUsers,
);

// ─── System-level audit monitoring (PRD §4.1) ─────────────────────────────────
// Reads the SAME `AuditLog` table as the tenant-scoped `/audit-logs` routes
// (`modules/audit/routes/audit-log.routes.ts`) — no second audit table, no
// duplicated query-building logic (see `MasterAdminAuditService`'s header
// comment). Deliberately no `tenantMiddleware` here, same reasoning as every
// other route in this file: a master admin isn't scoped to one tenant, so
// `requireRole(MASTER_ADMIN)` is the only gate, not `requirePermission()`.

/**
 * @swagger
 * /master-admin/audit-logs:
 *   get:
 *     tags: [Master Admin]
 *     summary: List audit log entries across every tenant
 *     description: Paginated, filterable, searchable cross-tenant activity feed. Each row includes the owning tenant's id and name.
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
 *         description: Case-insensitive match against description.
 *         schema: { type: string, maxLength: 100 }
 *       - name: tenantId
 *         in: query
 *         description: Restrict to one tenant. Omit to search across every tenant.
 *         schema: { type: string, format: uuid }
 *       - name: eventType
 *         in: query
 *         schema: { $ref: '#/components/schemas/AuditEventType' }
 *       - name: actorId
 *         in: query
 *         schema: { type: string, format: uuid }
 *       - name: targetType
 *         in: query
 *         schema: { type: string }
 *       - name: from
 *         in: query
 *         schema: { type: string, format: date }
 *       - name: to
 *         in: query
 *         schema: { type: string, format: date }
 *     responses:
 *       200: { description: Paginated list of audit log entries, each including tenantId/tenantName. }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller is not a master admin., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Invalid query parameters., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.get(
  '/audit-logs',
  authMiddleware,
  requireRole(UserRole.MASTER_ADMIN),
  validate({ query: listMasterAdminAuditLogsQuerySchema }),
  MasterAdminAuditController.list,
);

/**
 * @swagger
 * /master-admin/audit-logs/{id}:
 *   get:
 *     tags: [Master Admin]
 *     summary: Get an audit log entry by ID (any tenant)
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Audit log entry found, including tenantId/tenantName. }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller is not a master admin., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No audit log entry with this ID exists., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: id is not a valid UUID., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.get(
  '/audit-logs/:id',
  authMiddleware,
  requireRole(UserRole.MASTER_ADMIN),
  validate({ params: auditLogIdParamSchema }),
  MasterAdminAuditController.getById,
);

// ─── Plan catalog (PRD §4.1 "Manage plans and add-ons") ──────────────────────
// `Plan` conceptually belongs to `modules/billing` (the tenant-facing
// subscription catalog) — these routes just add a role-gated admin surface
// on top of that module's own `PlanController`, matching the same
// composition precedent as importing `TenantController`... except that one
// lives in this module already. No create/update route conflict: `/billing`
// only exposes a read-only `GET /plans` for tenants.

/**
 * @swagger
 * /master-admin/plans:
 *   get:
 *     tags: [Master Admin]
 *     summary: List every plan, including inactive ones, with tenant counts
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Every plan., content: { application/json: { schema: { type: object } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller is not a master admin., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.get('/plans', authMiddleware, requireRole(UserRole.MASTER_ADMIN), PlanController.listForAdmin);

/**
 * @swagger
 * /master-admin/plans:
 *   post:
 *     tags: [Master Admin]
 *     summary: Create a plan
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       201: { description: Plan created., content: { application/json: { schema: { type: object } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller is not a master admin., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       409: { description: A plan with this code already exists., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.post(
  '/plans',
  authMiddleware,
  requireRole(UserRole.MASTER_ADMIN),
  validate({ body: createPlanSchema }),
  PlanController.create,
);

/**
 * @swagger
 * /master-admin/plans/{id}:
 *   patch:
 *     tags: [Master Admin]
 *     summary: Update a plan's price, limits, or active status
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Plan updated., content: { application/json: { schema: { type: object } } } }
 *       401: { description: Missing or invalid access token., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       403: { description: Caller is not a master admin., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       404: { description: No plan with this ID exists., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 *       422: { description: Validation failed., content: { application/json: { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } }
 */
router.patch(
  '/plans/:id',
  authMiddleware,
  requireRole(UserRole.MASTER_ADMIN),
  validate({ params: planIdParamSchema, body: updatePlanSchema }),
  PlanController.update,
);

export default router;
