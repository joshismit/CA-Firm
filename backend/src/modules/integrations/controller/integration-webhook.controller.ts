import { Request, Response } from 'express';
import { HTTP_STATUS } from '@shared/constants';
import { asyncHandler } from '@shared/utils';
import { IntegrationWebhookService } from '../service/integration-webhook.service';

/**
 * Public — no `authMiddleware`/`tenantMiddleware`, mirrors
 * `PaymentGatewayWebhookController`'s exact reasoning: the third-party
 * provider calls this directly, with no way to carry a bearer token,
 * authenticated only by whatever signature scheme its own
 * `IntegrationProvider.webhook()` implementation verifies. Always responds
 * 200 once the call has been logged, whether or not the signature was
 * valid — the provider only cares about the 2xx status and retries on
 * anything else, same convention as every other webhook controller in
 * this codebase.
 */
export class IntegrationWebhookController {
  static handle = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new IntegrationWebhookService();
    const { provider, connectionId } = req.params as { provider: string; connectionId: string };
    const signature = req.header('x-integration-signature') ?? req.header('x-webhook-signature') ?? undefined;

    await service.handleWebhook({
      providerKey: provider,
      connectionId,
      rawBody: req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {})),
      headers: req.headers as Record<string, string | undefined>,
      signature,
    });

    res.status(HTTP_STATUS.OK).json({ received: true });
  });
}
