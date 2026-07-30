import express, { Application } from 'express';
import { correlationIdMiddleware } from '@middlewares/correlation-id.middleware';
import { requestLoggerMiddleware } from '@middlewares/request-logger.middleware';
import { errorMiddleware } from '@middlewares/error.middleware';
import notificationRoutes from '@modules/notifications/routes/notification.routes';

/**
 * Builds a real Express app around the actual production middleware chain
 * and the real Notifications router — not a copy, the same module the app
 * itself uses. Mirrors `tests/integration/helpers/contact-test-app.ts`.
 */
export function createNotificationTestApp(): Application {
  const app = express();
  app.use(correlationIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(express.json());
  app.use('/api/v1/notifications', notificationRoutes);
  app.use(errorMiddleware);
  return app;
}
