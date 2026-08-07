import { Router } from 'express';
import { validate } from '@middlewares/validation.middleware';
import { IntegrationWebhookController } from '../controller/integration-webhook.controller';
import { integrationWebhookParamsSchema } from '../schemas';

/**
 * Mounted at `${API.PREFIX}/integrations/webhook` (PRD §17 Step 9:
 * `POST /integrations/webhook/:provider`) — `:connectionId` is a second path
 * segment rather than a query param so it's mandatory by construction; see
 * `IntegrationConnectionMapper`'s `webhookUrl` for where this URL is handed
 * to a tenant. Deliberately public, mirrors
 * `modules/client-billing/routes/payment-gateway-webhook.routes.ts`.
 */
const router = Router();

router.post('/:provider/:connectionId', validate({ params: integrationWebhookParamsSchema }), IntegrationWebhookController.handle);

export default router;
