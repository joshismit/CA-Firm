import express, { Application } from 'express';
import { correlationIdMiddleware } from '@middlewares/correlation-id.middleware';
import { requestLoggerMiddleware } from '@middlewares/request-logger.middleware';
import { errorMiddleware } from '@middlewares/error.middleware';
import calendarRoutes from '@modules/calendar/routes/calendar.routes';

/**
 * Builds a real Express app around the actual production middleware chain and
 * the real Work Calendar router — not a copy, the same module the app itself
 * uses. Mirrors `tests/integration/helpers/dashboard-test-app.ts`.
 */
export function createCalendarTestApp(): Application {
  const app = express();
  app.use(correlationIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(express.json());
  app.use('/api/v1/calendar', calendarRoutes);
  app.use(errorMiddleware);
  return app;
}
