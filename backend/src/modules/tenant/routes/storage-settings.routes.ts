import { Router } from 'express';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { requirePermission } from '@middlewares/permission.middleware';
import { validate } from '@middlewares/validation.middleware';
import { StorageSettingsController } from '../controller/storage-settings.controller';
import { TENANT_SETTINGS_PERMISSIONS } from '../constants/tenant.permissions';
import { updateStorageSettingsSchema } from '../schemas/storage-settings.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Firm Storage Settings Routes (PRD §7.4 — Upload Rules)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every route runs: authMiddleware → tenantMiddleware → requirePermission →
 * [validate →] controller — mirrors `modules/tenant/routes/branding.routes.ts`
 * exactly, reusing the same `TENANT_SETTINGS_PERMISSIONS` (no new permission
 * strings).
 * ─────────────────────────────────────────────────────────────────────────────
 */
const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     StorageSettings:
 *       type: object
 *       properties:
 *         maxUploadSizeMb:
 *           type: integer
 *           description: PRD §7.4 — read-only, plan-derived per-file upload size ceiling in MB. Change it via a master admin (PATCH /master-admin/tenants/{id}/limits), not through this endpoint.
 *         defaultBusinessStorageQuotaMb:
 *           type: integer
 *           nullable: true
 *           description: PRD §7.4 — firm-admin-editable default storage quota (MB) applied to businesses with no quota override of their own. Null means the platform default (500 MB) is used.
 *       required: [maxUploadSizeMb, defaultBusinessStorageQuotaMb]
 *     UpdateStorageSettingsRequest:
 *       type: object
 *       properties:
 *         defaultBusinessStorageQuotaMb:
 *           type: integer
 *           minimum: 1
 *           nullable: true
 */

/**
 * @swagger
 * /settings/storage:
 *   get:
 *     tags: [Firm Storage Settings]
 *     summary: Get the firm's upload/storage settings
 *     description: PRD §7.4. `maxUploadSizeMb` is the tenant's current effective per-file upload limit (plan-derived); `defaultBusinessStorageQuotaMb` is the firm's own configurable default for businesses without a quota override.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: settings:read
 *     responses:
 *       200: { description: Storage settings., content: { application/json: { schema: { type: object, properties: { data: { $ref: '#/components/schemas/StorageSettings' } } } } } }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `settings:read` permission. }
 *   patch:
 *     tags: [Firm Storage Settings]
 *     summary: Update the firm's default business storage quota
 *     description: Only `defaultBusinessStorageQuotaMb` is settable here — the per-file upload limit is plan-derived and master-admin-controlled. Generates an audit log entry (SETTINGS_UPDATE) when the value actually changes.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: settings:manage
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/UpdateStorageSettingsRequest' } } }
 *     responses:
 *       200: { description: Storage settings updated., content: { application/json: { schema: { type: object, properties: { data: { $ref: '#/components/schemas/StorageSettings' } } } } } }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `settings:manage` permission. }
 *       422: { description: Validation failed. }
 */
router.get(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(TENANT_SETTINGS_PERMISSIONS.READ),
  StorageSettingsController.get,
);

router.patch(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(TENANT_SETTINGS_PERMISSIONS.MANAGE),
  validate({ body: updateStorageSettingsSchema }),
  StorageSettingsController.update,
);

export default router;
