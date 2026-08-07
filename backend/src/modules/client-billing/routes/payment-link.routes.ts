import { Router } from 'express';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { requirePermission } from '@middlewares/permission.middleware';
import { validate } from '@middlewares/validation.middleware';
import { PaymentLinkController } from '../controller/payment-link.controller';
import { CLIENT_BILLING_PERMISSIONS } from '../constants/client-billing.permissions';
import { createPaymentLinkSchema, listPaymentLinksQuerySchema } from '../schemas/payment-link.schema';

/** Mounted at `${API.PREFIX}/billing/payment-links` (PRD §12 — payment links for invoices/outstanding payments). */
const router = Router();

router.get(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CLIENT_BILLING_PERMISSIONS.READ),
  validate({ query: listPaymentLinksQuerySchema }),
  PaymentLinkController.list,
);

router.post(
  '/',
  authMiddleware,
  tenantMiddleware,
  requirePermission(CLIENT_BILLING_PERMISSIONS.MANAGE),
  validate({ body: createPaymentLinkSchema }),
  PaymentLinkController.create,
);

export default router;
