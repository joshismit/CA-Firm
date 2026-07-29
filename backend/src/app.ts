import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';

import { correlationIdMiddleware } from '@middlewares/correlation-id.middleware';
import { requestLoggerMiddleware } from '@middlewares/request-logger.middleware';
import { errorMiddleware } from '@middlewares/error.middleware';
import { ApiResponseHelper } from '@shared/response/api-response';
import { API } from '@shared/constants';
import { env } from '@config/environment';
import { swaggerSpec } from '@config/swagger';
import { authRoutes } from '@modules/auth';
import { projectRoutes } from '@modules/projects';
import { taskRoutes } from '@modules/tasks';
import { businessRoutes } from '@modules/business';
import { contactRoutes } from '@modules/contacts';
import { crmRoutes } from '@modules/crm';
import { documentRoutes } from '@modules/documents';

const app: Application = express();

// 1. Foundation Middlewares (Must run first)
app.use(correlationIdMiddleware);
app.use(requestLoggerMiddleware);

// 2. Standard Middlewares
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Health Check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json(
    ApiResponseHelper.success(req, { status: 'ok' }, 'CA Firm ERP API is running')
  );
});

// 4. API Routes & Documentation
if (env.ENABLE_SWAGGER) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

app.use(`${API.PREFIX}/auth`, authRoutes);
app.use(`${API.PREFIX}/projects`, projectRoutes);
app.use(`${API.PREFIX}/tasks`, taskRoutes);
app.use(`${API.PREFIX}/business`, businessRoutes);
app.use(`${API.PREFIX}/contacts`, contactRoutes);
app.use(`${API.PREFIX}/crm`, crmRoutes);
app.use(`${API.PREFIX}/documents`, documentRoutes);

// 5. Global Error Handler (Must run last)
app.use(errorMiddleware);

export default app;
