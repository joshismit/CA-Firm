import { Router } from 'express';
import { authMiddleware } from '@middlewares/auth.middleware';
import { tenantMiddleware } from '@middlewares/tenant.middleware';
import { requirePermission } from '@middlewares/permission.middleware';
import { validate } from '@middlewares/validation.middleware';
import { BillingController } from '../controller/billing.controller';
import { PlanController } from '../controller/plan.controller';
import { BILLING_PERMISSIONS } from '../constants/billing.permissions';
import {
  createCheckoutSessionSchema,
  listInvoicesQuerySchema,
  verifyCheckoutPaymentSchema,
} from '../schemas/billing.schema';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Billing Routes (tenant-facing)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Mounted at `${API.PREFIX}/subscription` in app.ts — deliberately NOT
 * `/billing`, which `modules/client-billing` already owns for `/billing/
 * invoices|expenses|payments` (the firm's billing of its OWN clients, an
 * unrelated domain). Reusing that prefix here would collide on `/invoices`.
 *
 * `/webhook` is the only public route here (Razorpay's server calls it
 * directly — see `BillingController.webhook`'s comment). Every other route
 * runs the standard authMiddleware → tenantMiddleware → requirePermission →
 * validate → controller chain. Master-admin's own `/master-admin/plans*`
 * routes reuse `PlanController` from this same module (see this module's
 * `index.ts`) rather than duplicating Plan CRUD there.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const router = Router();

router.get('/plans', authMiddleware, tenantMiddleware, requirePermission(BILLING_PERMISSIONS.READ), PlanController.listPublic);

router.get(
  '/current',
  authMiddleware,
  tenantMiddleware,
  requirePermission(BILLING_PERMISSIONS.READ),
  BillingController.getSubscription,
);

router.get(
  '/invoices',
  authMiddleware,
  tenantMiddleware,
  requirePermission(BILLING_PERMISSIONS.READ),
  validate({ query: listInvoicesQuerySchema }),
  BillingController.listInvoices,
);

router.post(
  '/checkout',
  authMiddleware,
  tenantMiddleware,
  requirePermission(BILLING_PERMISSIONS.MANAGE),
  validate({ body: createCheckoutSessionSchema }),
  BillingController.createCheckout,
);

router.post(
  '/checkout/verify',
  authMiddleware,
  tenantMiddleware,
  requirePermission(BILLING_PERMISSIONS.MANAGE),
  validate({ body: verifyCheckoutPaymentSchema }),
  BillingController.verifyCheckout,
);

// Public — see BillingController.webhook's comment.
router.post('/webhook', BillingController.webhook);

export default router;
