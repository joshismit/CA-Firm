import express, { Application } from 'express';
import { correlationIdMiddleware } from '@middlewares/correlation-id.middleware';
import { requestLoggerMiddleware } from '@middlewares/request-logger.middleware';
import { errorMiddleware } from '@middlewares/error.middleware';
import dashboardPreferenceRoutes from '@modules/dashboard/routes/dashboard-preference.routes';

/**
 * Builds a real Express app around the actual production middleware chain
 * and the real Dashboard Preference router — not a copy, the same module the
 * app itself uses. Mirrors `tests/integration/helpers/notification-test-app.ts`.
 */
export function createDashboardPreferenceTestApp(): Application {
  const app = express();
  app.use(correlationIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(express.json());
  app.use('/api/v1/dashboard/preferences', dashboardPreferenceRoutes);
  app.use(errorMiddleware);
  return app;
}
