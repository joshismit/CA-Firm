import express, { Application } from 'express';
import { correlationIdMiddleware } from '@middlewares/correlation-id.middleware';
import { requestLoggerMiddleware } from '@middlewares/request-logger.middleware';
import { errorMiddleware } from '@middlewares/error.middleware';
import projectRoutes from '@modules/projects/routes/project.routes';

/**
 * Builds a real Express app around the actual production middleware chain
 * and the real Projects router — not a copy, the same modules the app
 * itself uses. `app.ts` does not yet mount any versioned router
 * (`// TODO: Mount v1 router here`), so this assembles the equivalent
 * pipeline for testing without modifying that shared, still-incomplete file.
 * helmet/cors/compression are intentionally omitted — they don't participate
 * in the JWT → tenant → permission → validation → controller chain being
 * tested here.
 */
export function createTestApp(): Application {
  const app = express();
  app.use(correlationIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(express.json());
  app.use('/api/v1/projects', projectRoutes);
  app.use(errorMiddleware);
  return app;
}
