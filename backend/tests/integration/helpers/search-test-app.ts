import express, { Application } from 'express';
import { correlationIdMiddleware } from '@middlewares/correlation-id.middleware';
import { requestLoggerMiddleware } from '@middlewares/request-logger.middleware';
import { errorMiddleware } from '@middlewares/error.middleware';
import searchRoutes from '@modules/search/routes/search.routes';

/**
 * Builds a real Express app around the actual production middleware chain
 * and the real Search router — not a copy, the same module the app itself
 * uses. Mirrors `tests/integration/helpers/report-test-app.ts`.
 */
export function createSearchTestApp(): Application {
  const app = express();
  app.use(correlationIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(express.json());
  app.use('/api/v1/search', searchRoutes);
  app.use(errorMiddleware);
  return app;
}
