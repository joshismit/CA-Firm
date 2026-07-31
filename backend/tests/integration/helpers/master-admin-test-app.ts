import express, { Application } from 'express';
import { correlationIdMiddleware } from '@middlewares/correlation-id.middleware';
import { requestLoggerMiddleware } from '@middlewares/request-logger.middleware';
import { errorMiddleware } from '@middlewares/error.middleware';
import masterAdminRoutes from '@modules/master-admin/routes/master-admin.routes';

/**
 * Builds a real Express app around the actual production middleware chain
 * and the real Master Admin router — not a copy, the same module the app
 * itself uses. Mirrors `tests/integration/helpers/business-test-app.ts`.
 */
export function createMasterAdminTestApp(): Application {
  const app = express();
  app.use(correlationIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(express.json());
  app.use('/api/v1/master-admin', masterAdminRoutes);
  app.use(errorMiddleware);
  return app;
}
