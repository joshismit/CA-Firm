import express, { Application } from 'express';
import { correlationIdMiddleware } from '@middlewares/correlation-id.middleware';
import { requestLoggerMiddleware } from '@middlewares/request-logger.middleware';
import { errorMiddleware } from '@middlewares/error.middleware';
import documentRoutes from '@modules/documents/routes/document.routes';

/**
 * Builds a real Express app around the actual production middleware chain
 * and the real Documents router — not a copy, the same module the app
 * itself uses. Mirrors `tests/integration/helpers/crm-test-app.ts`.
 */
export function createDocumentTestApp(): Application {
  const app = express();
  app.use(correlationIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(express.json());
  app.use('/api/v1/documents', documentRoutes);
  app.use(errorMiddleware);
  return app;
}
