import { Router } from 'express';
import multer from 'multer';
import { UPLOAD } from '@shared/constants';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { requirePermission } from '@middlewares/permission.middleware';
import { validate } from '@middlewares/validation.middleware';
import { BrandingController } from '../controller/branding.controller';
import { TENANT_SETTINGS_PERMISSIONS } from '../constants/tenant.permissions';
import { updateTenantBrandingSchema, uploadBrandingAssetSchema } from '../schemas/branding.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Tenant Branding Routes (PRD §4.3 — white-label)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every route runs: authMiddleware → tenantMiddleware → requirePermission →
 * [upload →] validate → controller. Mirrors `modules/documents/routes/
 * document.routes.ts` exactly, including the same upload-before-validate
 * ordering rationale (multer populates `req.body.slot` from the multipart
 * payload before `validate()` can check it).
 * ─────────────────────────────────────────────────────────────────────────────
 */
const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD.MAX_AVATAR_SIZE_BYTES },
});

/**
 * @swagger
 * components:
 *   schemas:
 *     TenantBranding:
 *       type: object
 *       properties:
 *         firmName: { type: string, nullable: true }
 *         logoUrl: { type: string, nullable: true }
 *         logoDarkUrl: { type: string, nullable: true }
 *         faviconUrl: { type: string, nullable: true }
 *         loginBgUrl: { type: string, nullable: true }
 *         primaryColor: { type: string, nullable: true, example: '#1a73e8' }
 *         secondaryColor: { type: string, nullable: true }
 *         accentColor: { type: string, nullable: true }
 *         backgroundColor: { type: string, nullable: true }
 *         emailHeaderColor: { type: string, nullable: true }
 *         fontFamily: { type: string, nullable: true }
 *         customCss: { type: string, nullable: true }
 *         emailFooterText: { type: string, nullable: true }
 *         footerText: { type: string, nullable: true }
 *         supportEmail: { type: string, nullable: true }
 *         supportPhone: { type: string, nullable: true }
 *         updatedAt: { type: string, format: date-time, nullable: true }
 *     UpdateTenantBrandingRequest:
 *       type: object
 *       properties:
 *         firmName: { type: string }
 *         primaryColor: { type: string }
 *         secondaryColor: { type: string }
 *         accentColor: { type: string }
 *         backgroundColor: { type: string }
 *         emailHeaderColor: { type: string }
 *         fontFamily: { type: string }
 *         customCss: { type: string }
 *         emailFooterText: { type: string }
 *         footerText: { type: string }
 *         supportEmail: { type: string }
 *         supportPhone: { type: string }
 */

/**
 * @swagger
 * /settings/branding:
 *   get:
 *     tags: [Tenant Branding]
 *     summary: Get the tenant's branding settings
 *     description: Returns an all-null response if this tenant has never configured branding — not a 404.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: settings:read
 *     responses:
 *       200: { description: Branding settings., content: { application/json: { schema: { type: object, properties: { data: { $ref: '#/components/schemas/TenantBranding' } } } } } }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `settings:read` permission. }
 *   patch:
 *     tags: [Tenant Branding]
 *     summary: Update the tenant's branding settings
 *     description: Partial update. Creates the branding row on first write.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: settings:manage
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/UpdateTenantBrandingRequest' } } }
 *     responses:
 *       200: { description: Branding updated. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `settings:manage` permission. }
 *       422: { description: Validation failed. }
 */
router.get(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(TENANT_SETTINGS_PERMISSIONS.READ),
  BrandingController.get,
);

router.patch(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(TENANT_SETTINGS_PERMISSIONS.MANAGE),
  validate({ body: updateTenantBrandingSchema }),
  BrandingController.update,
);

/**
 * @swagger
 * /settings/branding/assets:
 *   post:
 *     tags: [Tenant Branding]
 *     summary: Upload a branding image asset
 *     description: Uploads to the configured bucket and updates the corresponding branding column. Accepts one of logo/logoDark/favicon/loginBg per call.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: settings:manage
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, slot]
 *             properties:
 *               file: { type: string, format: binary }
 *               slot: { type: string, enum: [logo, logoDark, favicon, loginBg] }
 *     responses:
 *       200: { description: Asset uploaded; returns the updated branding settings. }
 *       400: { description: No file, unsupported file type, or file exceeds the maximum upload size. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `settings:manage` permission. }
 *       422: { description: Validation failed. }
 */
router.post(
  '/assets',
  authMiddleware,
  tenantMiddleware,
  requirePermission(TENANT_SETTINGS_PERMISSIONS.MANAGE),
  upload.single('file'),
  validate({ body: uploadBrandingAssetSchema }),
  BrandingController.uploadAsset,
);

export default router;
