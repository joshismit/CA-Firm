import express, { Application } from 'express';
import { correlationIdMiddleware } from '@middlewares/correlation-id.middleware';
import { requestLoggerMiddleware } from '@middlewares/request-logger.middleware';
import { errorMiddleware } from '@middlewares/error.middleware';
import billingRoutes from '@modules/billing/routes/billing.routes';

/**
 * Builds a real Express app around the actual production middleware chain
 * and the real Billing router — not a copy, the same module the app itself
 * uses. Mirrors `tests/integration/helpers/business-test-app.ts`.
 *
 * The `verify` callback mirrors `app.ts`'s own `express.json()` setup exactly
 * — the webhook signature test needs `req.rawBody` populated the same way
 * production does.
 */
export function createBillingTestApp(): Application {
  const app = express();
  app.use(correlationIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(express.json({ verify: (req, _res, buf) => { (req as express.Request).rawBody = buf; } }));
  app.use('/api/v1/subscription', billingRoutes);
  app.use(errorMiddleware);
  return app;
}
