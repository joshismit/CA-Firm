import express, { Application } from 'express';
import { correlationIdMiddleware } from '@middlewares/correlation-id.middleware';
import { requestLoggerMiddleware } from '@middlewares/request-logger.middleware';
import { errorMiddleware } from '@middlewares/error.middleware';
import documentRoutes from '@modules/documents/routes/document.routes';
import documentFolderRoutes from '@modules/documents/routes/document-folder.routes';

/**
 * Builds a real Express app around the actual production middleware chain
 * and the real Documents routers (documents + folders, mounted on the same
 * prefix exactly as `src/app.ts` does) — not a copy, the same modules the
 * app itself uses. Mirrors `tests/integration/helpers/crm-test-app.ts`.
 */
export function createDocumentTestApp(): Application {
  const app = express();
  app.use(correlationIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(express.json());
  app.use('/api/v1/documents', documentRoutes);
  app.use('/api/v1/documents', documentFolderRoutes);
  app.use(errorMiddleware);
  return app;
}
