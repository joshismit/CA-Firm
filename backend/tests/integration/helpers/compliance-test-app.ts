import express, { Application } from 'express';
import { ComplianceCategory } from '@prisma/client';
import { correlationIdMiddleware } from '@middlewares/correlation-id.middleware';
import { requestLoggerMiddleware } from '@middlewares/request-logger.middleware';
import { errorMiddleware } from '@middlewares/error.middleware';
import { createComplianceFilingRoutes } from '@modules/compliance/routes/compliance-filing.routes';

/**
 * Builds a real Express app around the actual production middleware chain
 * and the real Compliance route factory — not a copy, the same module the
 * app itself uses. Mounts BOTH /gst and /itr (not just one) so tests can
 * verify cross-category isolation (a filing created via /gst must not be
 * reachable via /itr/:id even for the same tenant/id). Mirrors
 * `tests/integration/helpers/contact-test-app.ts`.
 */
export function createComplianceTestApp(): Application {
  const app = express();
  app.use(correlationIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(express.json());
  app.use('/api/v1/gst', createComplianceFilingRoutes(ComplianceCategory.GST));
  app.use('/api/v1/itr', createComplianceFilingRoutes(ComplianceCategory.ITR));
  app.use(errorMiddleware);
  return app;
}
