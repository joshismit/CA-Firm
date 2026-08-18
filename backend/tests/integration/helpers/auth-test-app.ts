import express, { Application } from 'express';
import { correlationIdMiddleware } from '@middlewares/correlation-id.middleware';
import { requestLoggerMiddleware } from '@middlewares/request-logger.middleware';
import { errorMiddleware } from '@middlewares/error.middleware';
import authRoutes from '@modules/auth/routes/auth.routes';

/**
 * Builds a real Express app around the actual production middleware chain
 * and the real Auth router — not a copy, the same module the app itself
 * uses. Mirrors `tests/integration/helpers/business-test-app.ts`.
 */
export function createAuthTestApp(): Application {
  const app = express();
  app.use(correlationIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(express.json());
  app.use('/api/v1/auth', authRoutes);
  app.use(errorMiddleware);
  return app;
}
