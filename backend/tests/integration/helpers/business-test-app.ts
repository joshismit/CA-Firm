import express, { Application } from 'express';
import { correlationIdMiddleware } from '@middlewares/correlation-id.middleware';
import { requestLoggerMiddleware } from '@middlewares/request-logger.middleware';
import { errorMiddleware } from '@middlewares/error.middleware';
import businessRoutes from '@modules/business/routes/business.routes';

/**
 * Builds a real Express app around the actual production middleware chain
 * and the real Business router — not a copy, the same modules the app itself
 * uses. Mirrors `tests/integration/helpers/task-test-app.ts`; kept as a
 * separate file rather than generalizing the shared one, so the existing
 * Project/Task integration suites stay untouched.
 */
export function createBusinessTestApp(): Application {
  const app = express();
  app.use(correlationIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(express.json());
  app.use('/api/v1/business', businessRoutes);
  app.use(errorMiddleware);
  return app;
}
