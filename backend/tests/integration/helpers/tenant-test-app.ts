import express, { Application } from 'express';
import { correlationIdMiddleware } from '@middlewares/correlation-id.middleware';
import { requestLoggerMiddleware } from '@middlewares/request-logger.middleware';
import { errorMiddleware } from '@middlewares/error.middleware';
import brandingRoutes from '@modules/tenant/routes/branding.routes';
import domainRoutes from '@modules/tenant/routes/domain.routes';
import publicBrandingRoutes from '@modules/tenant/routes/public-branding.routes';
import storageSettingsRoutes from '@modules/tenant/routes/storage-settings.routes';

/**
 * Builds a real Express app around the actual production middleware chain
 * and the real tenant-module routers — not copies, the same modules
 * the app itself uses. Mirrors `tests/integration/helpers/document-test-app.ts`.
 */
export function createTenantTestApp(): Application {
  const app = express();
  app.use(correlationIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(express.json());
  app.use('/api/v1/settings/branding', brandingRoutes);
  app.use('/api/v1/settings/domain', domainRoutes);
  app.use('/api/v1/public', publicBrandingRoutes);
  // PRD §7.4 — Firm Settings → Storage.
  app.use('/api/v1/settings/storage', storageSettingsRoutes);
  app.use(errorMiddleware);
  return app;
}
