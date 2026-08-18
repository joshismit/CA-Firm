import express, { Application } from 'express';
import { correlationIdMiddleware } from '@middlewares/correlation-id.middleware';
import { requestLoggerMiddleware } from '@middlewares/request-logger.middleware';
import { errorMiddleware } from '@middlewares/error.middleware';
import integrationRoutes from '@modules/integrations/routes/integration.routes';
import integrationWebhookRoutes from '@modules/integrations/routes/integration-webhook.routes';

/**
 * Builds a real Express app around the actual production middleware chain and
 * the real Integration Framework routers (PRD §17) — mirrors
 * `tests/integration/helpers/client-billing-test-app.ts`. The `verify`
 * callback mirrors `app.ts`'s own `express.json()` setup so
 * `integration-webhook.routes.spec.ts` gets a populated `req.rawBody`, same
 * as production.
 */
export function createIntegrationTestApp(): Application {
  const app = express();
  app.use(correlationIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as express.Request).rawBody = buf;
      },
    }),
  );
  app.use('/api/v1/integrations/webhook', integrationWebhookRoutes);
  app.use('/api/v1/integrations', integrationRoutes);
  app.use(errorMiddleware);
  return app;
}
