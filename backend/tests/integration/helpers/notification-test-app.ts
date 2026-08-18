import express, { Application } from 'express';
import { correlationIdMiddleware } from '@middlewares/correlation-id.middleware';
import { requestLoggerMiddleware } from '@middlewares/request-logger.middleware';
import { errorMiddleware } from '@middlewares/error.middleware';
import notificationRoutes from '@modules/notifications/routes/notification.routes';
import notificationTemplateRoutes from '@modules/notifications/routes/notification-template.routes';
import notificationPreferenceRoutes from '@modules/notifications/routes/notification-preference.routes';
import notificationProviderRoutes from '@modules/notifications/routes/notification-provider.routes';

/**
 * Builds a real Express app around the actual production middleware chain
 * and the real Notifications routers — not a copy, the same modules the app
 * itself uses, mounted at the same prefixes as `src/app.ts`. Mirrors
 * `tests/integration/helpers/contact-test-app.ts`.
 */
export function createNotificationTestApp(): Application {
  const app = express();
  app.use(correlationIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(express.json());
  app.use('/api/v1/notifications', notificationRoutes);
  app.use('/api/v1/notification-templates', notificationTemplateRoutes);
  app.use('/api/v1/notification-settings', notificationPreferenceRoutes);
  app.use('/api/v1/notification-providers', notificationProviderRoutes);
  app.use(errorMiddleware);
  return app;
}
