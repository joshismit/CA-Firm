import express, { Application } from 'express';
import { correlationIdMiddleware } from '@middlewares/correlation-id.middleware';
import { requestLoggerMiddleware } from '@middlewares/request-logger.middleware';
import { errorMiddleware } from '@middlewares/error.middleware';
import documentRequestRoutes from '@modules/documents/routes/document-request.routes';

/** Mirrors `tests/integration/helpers/contact-test-app.ts`. */
export function createDocumentRequestTestApp(): Application {
  const app = express();
  app.use(correlationIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(express.json());
  app.use('/api/v1/document-requests', documentRequestRoutes);
  app.use(errorMiddleware);
  return app;
}
