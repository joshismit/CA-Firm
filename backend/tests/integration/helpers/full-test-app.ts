import express, { Application, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { correlationIdMiddleware } from '@middlewares/correlation-id.middleware';
import { requestLoggerMiddleware } from '@middlewares/request-logger.middleware';
import { errorMiddleware } from '@middlewares/error.middleware';
import { ApiResponseHelper } from '@shared/response/api-response';
import { getLiveness, getReadiness } from '@shared/health/health.service';
import { swaggerSpec } from '@config/swagger';
import projectRoutes from '@modules/projects/routes/project.routes';
import taskRoutes from '@modules/tasks/routes/task.routes';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Full Test App
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Mirrors `src/app.ts` exactly (health, swagger, projects, tasks, error
 * middleware) so integration tests exercise the complete real production
 * middleware stack — including the /health and /api-docs endpoints — without
 * starting an actual server or binding a port.
 *
 * helmet/cors/compression are intentionally omitted — they don't participate
 * in the JWT → tenant → permission → validation → controller chain being
 * tested here and add noise to assertions.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function createFullTestApp(): Application {
  const app = express();

  // Foundation
  app.use(correlationIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health / Readiness — mirrors app.ts's own wiring exactly (see src/shared/health/health.service.ts)
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json(ApiResponseHelper.success(req, getLiveness(), 'CA Firm ERP API is running'));
  });

  app.get('/ready', async (req: Request, res: Response) => {
    const { ready, checks } = await getReadiness();
    res.status(ready ? 200 : 503).json({
      success: ready,
      status: ready ? 'READY' : 'NOT READY',
      checks,
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    });
  });

  // Swagger
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // API routes
  app.use('/api/v1/projects', projectRoutes);
  app.use('/api/v1/tasks', taskRoutes);

  // Error handler (must be last)
  app.use(errorMiddleware);

  return app;
}
