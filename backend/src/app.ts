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
import { userRoutes } from '@modules/users';
import { roleRoutes } from '@modules/roles';
import { permissionRoutes } from '@modules/permissions';
import { createComplianceFilingRoutes } from '@modules/compliance';
import { ComplianceCategory } from '@prisma/client';
import { invoiceRoutes, expenseRoutes, paymentRoutes } from '@modules/client-billing';
import { notificationRoutes } from '@modules/notifications';

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
app.use(`${API.PREFIX}/users`, userRoutes);
app.use(`${API.PREFIX}/roles`, roleRoutes);
app.use(`${API.PREFIX}/permissions`, permissionRoutes);

// One generic Compliance module, mounted 4x — matches the frontend's own
// sidebar route naming (/gst, /itr, /tds, /mca) exactly. See
// modules/compliance/routes/compliance-filing.routes.ts's header comment
// for why these routes have no requirePermission() gate.
app.use(`${API.PREFIX}/gst`, createComplianceFilingRoutes(ComplianceCategory.GST));
app.use(`${API.PREFIX}/itr`, createComplianceFilingRoutes(ComplianceCategory.ITR));
app.use(`${API.PREFIX}/tds`, createComplianceFilingRoutes(ComplianceCategory.TDS));
app.use(`${API.PREFIX}/mca`, createComplianceFilingRoutes(ComplianceCategory.MCA));

// Client Billing (Invoices/Expenses/Payments to the firm's own clients) — a
// completely separate domain from the unrelated, still-unbuilt SaaS
// subscription billing module. Both may eventually share the `/billing`
// prefix (this module's own sub-paths are /invoices, /expenses, /payments;
// SaaS billing's would be e.g. /subscription, /plans) with no route
// collision, since Express dispatches on the full path, not just the prefix.
app.use(`${API.PREFIX}/billing/invoices`, invoiceRoutes);
app.use(`${API.PREFIX}/billing/expenses`, expenseRoutes);
app.use(`${API.PREFIX}/billing/payments`, paymentRoutes);
app.use(`${API.PREFIX}/notifications`, notificationRoutes);

// 5. Global Error Handler (Must run last)
app.use(errorMiddleware);

export default app;
