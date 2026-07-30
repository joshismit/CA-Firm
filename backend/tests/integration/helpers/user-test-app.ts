import express, { Application } from 'express';
import { correlationIdMiddleware } from '@middlewares/correlation-id.middleware';
import { requestLoggerMiddleware } from '@middlewares/request-logger.middleware';
import { errorMiddleware } from '@middlewares/error.middleware';
import userRoutes from '@modules/users/routes/user.routes';

/**
 * Builds a real Express app around the actual production middleware chain
 * and the real Users router — not a copy, the same modules the app itself
 * uses. Mirrors `tests/integration/helpers/contact-test-app.ts`.
 */
export function createUserTestApp(): Application {
  const app = express();
  app.use(correlationIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(express.json());
  app.use('/api/v1/users', userRoutes);
  app.use(errorMiddleware);
  return app;
}
