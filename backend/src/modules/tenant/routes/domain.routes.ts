import { Router } from 'express';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { requirePermission } from '@middlewares/permission.middleware';
import { validate } from '@middlewares/validation.middleware';
import { DomainController } from '../controller/domain.controller';
import { TENANT_SETTINGS_PERMISSIONS } from '../constants/tenant.permissions';
import { createTenantDomainSchema } from '../schemas/domain.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Tenant Domain Routes (PRD §4.3 — white-label)
 * ─────────────────────────────────────────────────────────────────────────────
 * Every route runs: authMiddleware → tenantMiddleware → requirePermission →
 * [validate →] controller. One domain per tenant — see `TenantDomainService`'s
 * header comment.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     TenantDomain:
 *       type: object
 *       properties:
 *         domain: { type: string, example: firmname.cafirmapp.com }
 *         subdomain: { type: string, nullable: true, example: firmname }
 *         isVerified: { type: boolean }
 *         verifiedAt: { type: string, format: date-time, nullable: true }
 *         sslStatus: { type: string, enum: [PENDING, PROVISIONED, FAILED, EXPIRING] }
 *         verification:
 *           type: object
 *           nullable: true
 *           properties:
 *             recordType: { type: string, enum: [TXT] }
 *             recordName: { type: string }
 *             recordValue: { type: string }
 *         createdAt: { type: string, format: date-time }
 *     CreateTenantDomainRequest:
 *       type: object
 *       description: Provide exactly one of subdomain or customDomain.
 *       properties:
 *         subdomain: { type: string, example: firmname }
 *         customDomain: { type: string, example: portal.firmname.com }
 */

/**
 * @swagger
 * /settings/domain:
 *   get:
 *     tags: [Tenant Domain]
 *     summary: Get the tenant's configured domain
 *     description: Returns null if no domain is configured — not a 404.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: settings:read
 *     responses:
 *       200: { description: Domain configuration, or null. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `settings:read` permission. }
 *   post:
 *     tags: [Tenant Domain]
 *     summary: Configure a platform subdomain or custom domain
 *     description: A platform subdomain is verified immediately (the platform owns that DNS). A custom domain starts unverified — see `POST /settings/domain/verify`.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: settings:manage
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/CreateTenantDomainRequest' } } }
 *     responses:
 *       201: { description: Domain configured. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `settings:manage` permission. }
 *       409: { description: This tenant already has a domain configured, the subdomain is taken, or the custom domain is already in use. }
 *       422: { description: Validation failed. }
 *   delete:
 *     tags: [Tenant Domain]
 *     summary: Remove the tenant's configured domain
 *     security: [{ BearerAuth: [] }]
 *     x-permission: settings:manage
 *     responses:
 *       200: { description: Domain removed. }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `settings:manage` permission. }
 *       404: { description: No domain is configured for this tenant. }
 */
router.get(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(TENANT_SETTINGS_PERMISSIONS.READ),
  DomainController.get,
);

router.post(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(TENANT_SETTINGS_PERMISSIONS.MANAGE),
  validate({ body: createTenantDomainSchema }),
  DomainController.create,
);

router.delete(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(TENANT_SETTINGS_PERMISSIONS.MANAGE),
  DomainController.delete,
);

/**
 * @swagger
 * /settings/domain/verify:
 *   post:
 *     tags: [Tenant Domain]
 *     summary: Re-check DNS for the custom domain's verification TXT record
 *     description: Idempotent — a domain that isn't verified yet returns normally with isVerified still false, not an error. Real-time DNS lookup, not cached.
 *     security: [{ BearerAuth: [] }]
 *     x-permission: settings:manage
 *     responses:
 *       200: { description: Current verification state (may or may not have just become verified). }
 *       401: { description: Missing or invalid access token. }
 *       403: { description: Caller lacks the `settings:manage` permission. }
 *       404: { description: No domain is configured for this tenant. }
 */
router.post(
  '/verify',
  authMiddleware,
  tenantMiddleware,
  requirePermission(TENANT_SETTINGS_PERMISSIONS.MANAGE),
  DomainController.verify,
);

export default router;
