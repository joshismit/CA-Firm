import express, { Application } from 'express';
import { correlationIdMiddleware } from '@middlewares/correlation-id.middleware';
import { requestLoggerMiddleware } from '@middlewares/request-logger.middleware';
import { errorMiddleware } from '@middlewares/error.middleware';
import auditRoutes from '@modules/audit/routes/audit-log.routes';
import roleRoutes from '@modules/roles/routes/role.routes';

/**
 * Builds a real Express app around the actual production middleware chain
 * and the real Audit Logs + Roles routers — not copies, the same modules the
 * app itself uses. Roles is mounted alongside Audit Logs (not on its own,
 * like `role-test-app.ts` does) specifically so these tests can exercise the
 * real write path end-to-end: assign/revoke a role or change a role's
 * permissions through the real HTTP route, then read it back through the
 * real `GET /audit-logs` route, rather than asserting on `AuditLogRecorder`
 * in isolation. Mirrors `tests/integration/helpers/full-test-app.ts`'s
 * "mount more than one real router" pattern.
 */
export function createAuditTestApp(): Application {
  const app = express();
  app.use(correlationIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(express.json());
  app.use('/api/v1/audit-logs', auditRoutes);
  app.use('/api/v1/roles', roleRoutes);
  app.use(errorMiddleware);
  return app;
}
