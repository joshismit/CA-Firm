import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import { correlationIdMiddleware } from '@middlewares/correlation-id.middleware';
import { requestLoggerMiddleware } from '@middlewares/request-logger.middleware';
import { errorMiddleware } from '@middlewares/error.middleware';
import { ApiResponseHelper } from '@shared/response/api-response';

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

// 4. API Routes
// TODO: Mount v1 router here

// 5. Global Error Handler (Must run last)
app.use(errorMiddleware);

export default app;
