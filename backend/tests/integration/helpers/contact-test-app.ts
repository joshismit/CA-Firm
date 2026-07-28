import express, { Application } from 'express';
import { correlationIdMiddleware } from '@middlewares/correlation-id.middleware';
import { requestLoggerMiddleware } from '@middlewares/request-logger.middleware';
import { errorMiddleware } from '@middlewares/error.middleware';
import contactRoutes from '@modules/contacts/routes/contact.routes';

/**
 * Builds a real Express app around the actual production middleware chain
 * and the real Contacts router — not a copy, the same modules the app
 * itself uses. Mirrors `tests/integration/helpers/business-test-app.ts`.
 */
export function createContactTestApp(): Application {
  const app = express();
  app.use(correlationIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(express.json());
  app.use('/api/v1/contacts', contactRoutes);
  app.use(errorMiddleware);
  return app;
}
