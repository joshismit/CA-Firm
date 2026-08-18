import express, { Application } from 'express';
import { correlationIdMiddleware } from '@middlewares/correlation-id.middleware';
import { requestLoggerMiddleware } from '@middlewares/request-logger.middleware';
import { errorMiddleware } from '@middlewares/error.middleware';
import permissionRoutes from '@modules/permissions/routes/permission.routes';

/**
 * Builds a real Express app around the actual production middleware chain
 * and the real Permissions router — not a copy, the same modules the app
 * itself uses. Mirrors `tests/integration/helpers/contact-test-app.ts`.
 */
export function createPermissionTestApp(): Application {
  const app = express();
  app.use(correlationIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(express.json());
  app.use('/api/v1/permissions', permissionRoutes);
  app.use(errorMiddleware);
  return app;
}
