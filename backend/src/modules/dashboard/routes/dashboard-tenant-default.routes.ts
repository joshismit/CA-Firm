import { Router } from 'express';
import { UserRole } from '@shared/enums';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { requireRole } from '@middlewares/permission.middleware';
import { validate } from '@middlewares/validation.middleware';
import { DashboardTenantDefaultController } from '../controller/dashboard-tenant-default.controller';
import {
  updateDashboardTenantDefaultSchema,
  dashboardTenantDefaultRoleParamSchema,
} from '../schemas/dashboard-tenant-default.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Dashboard Tenant Default Routes (PRD §10.3)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every route: `authMiddleware → tenantMiddleware → requireRole(TENANT_ADMIN)
 * → validate → controller`. `requireRole`, not `requirePermission` — these
 * routes configure every OTHER user's default layout for the tenant, a
 * firm-wide administrative action with no natural fine-grained permission to
 * gate it (mirrors `modules/master-admin/routes`'s own `requireRole`-only
 * gating for the same "administrative, not data-permission-shaped" reason).
 * ─────────────────────────────────────────────────────────────────────────────
 */
const router = Router();

const requireTenantAdmin = requireRole(UserRole.TENANT_ADMIN);

/**
 * @swagger
 * /dashboard/tenant-defaults:
 *   get:
 *     tags: [Dashboard]
 *     summary: List this tenant's configured default dashboard layout per role
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: One entry per UserRole value. }
 *       403: { description: Caller is not a tenant admin. }
 */
router.get('/', authMiddleware, tenantMiddleware, requireTenantAdmin, DashboardTenantDefaultController.list);

/**
 * @swagger
 * /dashboard/tenant-defaults/{role}:
 *   put:
 *     tags: [Dashboard]
 *     summary: Configure the default dashboard layout for a given role
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: role
 *         required: true
 *         schema: { type: string, enum: [MASTER_ADMIN, TENANT_ADMIN, MANAGER, STAFF, CLIENT] }
 *     responses:
 *       200: { description: Default layout saved. }
 *       422: { description: Validation failed. }
 *   delete:
 *     tags: [Dashboard]
 *     summary: Remove the configured default for a role (falls back to the registry default)
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Default removed. }
 */
router.put(
  '/:role',
  authMiddleware,
  tenantMiddleware,
  requireTenantAdmin,
  validate({ params: dashboardTenantDefaultRoleParamSchema, body: updateDashboardTenantDefaultSchema }),
  DashboardTenantDefaultController.upsert,
);

router.delete(
  '/:role',
  authMiddleware,
  tenantMiddleware,
  requireTenantAdmin,
  validate({ params: dashboardTenantDefaultRoleParamSchema }),
  DashboardTenantDefaultController.remove,
);

export default router;
