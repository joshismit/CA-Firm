import { Router } from 'express';
import { PaymentGatewayWebhookController } from '../controller/payment-gateway-webhook.controller';

/**
 * Mounted at `${API.PREFIX}/billing/payment-gateway/webhook` — deliberately
 * a SEPARATE path from `modules/billing`'s `/subscription/webhook` (the
 * platform's own SaaS-subscription webhook). PRD §12: "Firm payment
 * webhooks must be completely independent" — this router, this controller,
 * this service, and this DB table (`PaymentGatewayLink`) share nothing with
 * the platform webhook's `BillingService.handleWebhook()`/`PlatformInvoice`
 * path. The only route here is intentionally public (no
 * `authMiddleware`/`tenantMiddleware`) — the gateway's server calls it
 * directly, authenticated only by the per-tenant HMAC signature.
 */
const router = Router();

router.post('/', PaymentGatewayWebhookController.handle);

export default router;
