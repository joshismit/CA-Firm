import express, { Application } from 'express';
import { correlationIdMiddleware } from '@middlewares/correlation-id.middleware';
import { requestLoggerMiddleware } from '@middlewares/request-logger.middleware';
import { errorMiddleware } from '@middlewares/error.middleware';
import dashboardRoutes from '@modules/dashboard/routes/dashboard.routes';
import dashboardTenantDefaultRoutes from '@modules/dashboard/routes/dashboard-tenant-default.routes';

/**
 * Builds a real Express app around the actual production middleware chain and
 * the real Dashboard aggregation + tenant-default routers — not copies, the
 * same modules the app itself uses. Mirrors
 * `tests/integration/helpers/dashboard-preference-test-app.ts`, mounted at
 * the same two prefixes `app.ts` uses (more specific `/tenant-defaults`
 * registered before the bare `/dashboard` router, for the same reason
 * `app.ts` itself orders them that way).
 */
export function createDashboardTestApp(): Application {
  const app = express();
  app.use(correlationIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(express.json());
  app.use('/api/v1/dashboard/tenant-defaults', dashboardTenantDefaultRoutes);
  app.use('/api/v1/dashboard', dashboardRoutes);
  app.use(errorMiddleware);
  return app;
}
