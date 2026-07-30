import express, { Application } from 'express';
import { correlationIdMiddleware } from '@middlewares/correlation-id.middleware';
import { requestLoggerMiddleware } from '@middlewares/request-logger.middleware';
import { errorMiddleware } from '@middlewares/error.middleware';
import reportRoutes from '@modules/reports/routes/report.routes';

/**
 * Builds a real Express app around the actual production middleware chain
 * and the real Reports router — not a copy, the same module the app itself
 * uses. Mirrors `tests/integration/helpers/contact-test-app.ts`.
 */
export function createReportTestApp(): Application {
  const app = express();
  app.use(correlationIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(express.json());
  app.use('/api/v1/reports', reportRoutes);
  app.use(errorMiddleware);
  return app;
}
