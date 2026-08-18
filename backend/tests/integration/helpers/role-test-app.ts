import express, { Application } from 'express';
import { correlationIdMiddleware } from '@middlewares/correlation-id.middleware';
import { requestLoggerMiddleware } from '@middlewares/request-logger.middleware';
import { errorMiddleware } from '@middlewares/error.middleware';
import roleRoutes from '@modules/roles/routes/role.routes';

/**
 * Builds a real Express app around the actual production middleware chain
 * and the real Roles router — not a copy, the same modules the app itself
 * uses. Mirrors `tests/integration/helpers/contact-test-app.ts`.
 */
export function createRoleTestApp(): Application {
  const app = express();
  app.use(correlationIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(express.json());
  app.use('/api/v1/roles', roleRoutes);
  app.use(errorMiddleware);
  return app;
}
