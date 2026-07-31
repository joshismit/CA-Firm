import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { BillingService } from '../service/billing.service';
import { CreateCheckoutSessionDto, ListInvoicesQueryDto, VerifyCheckoutPaymentDto } from '../dto/billing.req.dto';

/**
 * Thin HTTP adapter for the tenant-facing subscription-billing endpoints.
 * `webhook` is the one handler here not gated by `authMiddleware`/
 * `tenantMiddleware` (see `routes/billing.routes.ts`) — Razorpay's server
 * calls it directly, authenticated only by the HMAC signature the service
 * verifies against `req.rawBody`.
 */
export class BillingController {
  static getSubscription = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new BillingService(req);
    const subscription = await service.getSubscription();

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, subscription, MESSAGES.FETCHED));
  });

  static listInvoices = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new BillingService(req);
    const { data, meta } = await service.listInvoices(req.query as unknown as ListInvoicesQueryDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.paginated(req, data, meta));
  });

  static createCheckout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new BillingService(req);
    const session = await service.createCheckoutSession(req.body as CreateCheckoutSessionDto);

    res.status(HTTP_STATUS.CREATED).json(ApiResponseHelper.created(req, session));
  });

  static verifyCheckout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new BillingService(req);
    const subscription = await service.verifyPayment(req.body as VerifyCheckoutPaymentDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, subscription, 'Payment verified'));
  });

  static webhook = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new BillingService(req);
    const signature = req.header('x-razorpay-signature');
    await service.handleWebhook(req.rawBody, signature);

    // Razorpay only cares about the 2xx status — it retries on anything else.
    res.status(HTTP_STATUS.OK).json({ received: true });
  });
}
