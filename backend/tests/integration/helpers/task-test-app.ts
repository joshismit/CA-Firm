import express, { Application } from 'express';
import { correlationIdMiddleware } from '@middlewares/correlation-id.middleware';
import { requestLoggerMiddleware } from '@middlewares/request-logger.middleware';
import { errorMiddleware } from '@middlewares/error.middleware';
import taskRoutes from '@modules/tasks/routes/task.routes';
import taskTemplateRoutes from '@modules/tasks/routes/task-template.routes';

/**
 * Builds a real Express app around the actual production middleware chain
 * and the real Tasks + Task Templates routers — not a copy, the same modules
 * the app itself uses. Mirrors `tests/integration/helpers/test-app.ts`
 * (Projects); kept as a separate file rather than generalizing that one, so
 * the existing Project integration suite is untouched.
 */
export function createTaskTestApp(): Application {
  const app = express();
  app.use(correlationIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(express.json());
  app.use('/api/v1/tasks', taskRoutes);
  app.use('/api/v1/task-templates', taskTemplateRoutes);
  app.use(errorMiddleware);
  return app;
}
