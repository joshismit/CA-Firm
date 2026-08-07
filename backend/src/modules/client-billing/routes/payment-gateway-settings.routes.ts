import { Router } from 'express';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { requirePermission } from '@middlewares/permission.middleware';
import { validate } from '@middlewares/validation.middleware';
import { PaymentGatewaySettingsController } from '../controller/payment-gateway-settings.controller';
import { CLIENT_BILLING_PERMISSIONS } from '../constants/client-billing.permissions';
import { updatePaymentGatewaySettingsSchema } from '../schemas/payment-gateway-settings.schema';

/**
 * Mounted at `${API.PREFIX}/billing/payment-gateway/settings` — the ADMIN
 * API for a firm's OWN client-payment gateway configuration (PRD §12).
 * Reuses `CLIENT_BILLING_PERMISSIONS` (this is the client-billing domain,
 * not `BILLING_PERMISSIONS`, which gates the unrelated platform-subscription
 * module). Every route here is authenticated + tenant-scoped — unlike
 * `modules/billing/routes/billing.routes.ts`'s `/webhook`, there is no
 * public route in this file (the firm-payment webhook is its own separate
 * router — see `routes/payment-gateway-webhook.routes.ts`).
 */
const router = Router();

router.get('/', authMiddleware, tenantMiddleware, requirePermission(CLIENT_BILLING_PERMISSIONS.READ), PaymentGatewaySettingsController.get);

router.patch(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CLIENT_BILLING_PERMISSIONS.MANAGE),
  validate({ body: updatePaymentGatewaySettingsSchema }),
  PaymentGatewaySettingsController.update,
);

router.get(
  '/health',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CLIENT_BILLING_PERMISSIONS.READ),
  PaymentGatewaySettingsController.health,
);

router.get(
  '/capabilities',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CLIENT_BILLING_PERMISSIONS.READ),
  PaymentGatewaySettingsController.capabilities,
);

export default router;
