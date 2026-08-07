import { Request, Response } from 'express';
import { HTTP_STATUS } from '@shared/constants';
import { asyncHandler } from '@shared/utils';
import { PaymentGatewayWebhookService } from '../service/payment-gateway-webhook.service';

/**
 * Public — no `authMiddleware`/`tenantMiddleware` (see
 * `routes/payment-gateway-webhook.routes.ts`). The gateway's server calls
 * this directly; authentication is the per-tenant HMAC signature the
 * service verifies against `req.rawBody`, exactly like
 * `modules/billing/controller/billing.controller.ts`'s `webhook` handler
 * for the (unrelated) platform subscription webhook.
 */
export class PaymentGatewayWebhookController {
  static handle = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new PaymentGatewayWebhookService();
    const signature = req.header('x-razorpay-signature');
    await service.handleWebhook(req.rawBody, signature);

    // The gateway only cares about the 2xx status — it retries on anything else.
    res.status(HTTP_STATUS.OK).json({ received: true });
  });
}
