import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';

import { correlationIdMiddleware } from '@middlewares/correlation-id.middleware';
import { requestLoggerMiddleware } from '@middlewares/request-logger.middleware';
import { errorMiddleware } from '@middlewares/error.middleware';
import { generalRateLimiter } from '@middlewares/rate-limit.middleware';
import { ApiResponseHelper } from '@shared/response/api-response';
import { getLiveness, getReadiness } from '@shared/health/health.service';
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
import { dashboardPreferenceRoutes } from '@modules/dashboard';
import { reportRoutes } from '@modules/reports';
import { masterAdminRoutes } from '@modules/master-admin';
import { billingRoutes } from '@modules/billing';
import { auditRoutes } from '@modules/audit';
import { brandingRoutes, domainRoutes, publicBrandingRoutes } from '@modules/tenant';

const app: Application = express();

// Behind a single reverse-proxy hop in every real deployment (Docker/nginx, a
// load balancer) — without this, express-rate-limit and req.ip key off the
// proxy's own address instead of the real client, and `secure` cookie/req.protocol
// checks misread plain HTTP from the proxy as insecure.
app.set('trust proxy', 1);

// 1. Foundation Middlewares (Must run first)
app.use(correlationIdMiddleware);
app.use(requestLoggerMiddleware);

// 2. Standard Middlewares
app.use(
  helmet({
    // swagger-ui-express injects inline <script>/<style> tags to boot the UI;
    // relaxed only for script/style, and only when the docs are actually
    // mounted below. Every other directive stays at helmet's strict defaults.
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'default-src': ["'self'"],
        'img-src': ["'self'", 'data:'],
        'script-src': env.ENABLE_SWAGGER ? ["'self'", "'unsafe-inline'"] : ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'connect-src': ["'self'"],
      },
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xFrameOptions: { action: 'deny' },
    // Only meaningful over HTTPS — in dev/test the app is plain HTTP, so an
    // HSTS header would just be a lie the browser caches.
    strictTransportSecurity:
      env.NODE_ENV === 'production' ? { maxAge: 15552000, includeSubDomains: true } : false,
    // (x-powered-by removal, noSniff, and the rest of helmet's bundle stay on their defaults.)
  }),
);
app.use(
  cors({
    origin(origin, callback) {
      // No Origin header at all = same-origin, curl/Postman, or a server-to-server
      // call (e.g. the Razorpay webhook) — never a browser CORS request to police.
      if (!origin || env.NODE_ENV !== 'production') {
        callback(null, true);
        return;
      }
      const isKnownOrigin = origin === env.FRONTEND_URL || origin === env.APP_URL;
      // White-label tenants each get their own `<subdomain>.<PLATFORM_DOMAIN>` origin
      // (PRD §4.3) — there's no fixed list of these to allowlist ahead of time.
      const platformDomainPattern = new RegExp(
        `^https?://([a-z0-9-]+\\.)?${env.PLATFORM_DOMAIN.replace(/\./g, '\\.')}(:\\d+)?$`,
        'i',
      );
      callback(null, isKnownOrigin || platformDomainPattern.test(origin));
    },
    credentials: false, // bearer JWT in an Authorization header, never a cookie — no credentialed CORS needed
  }),
);
app.use(compression());
// `verify` captures the exact raw bytes onto req.rawBody before JSON-parsing replaces
// req.body — needed by the Razorpay webhook route to verify the HMAC signature, which is
// computed over the raw payload, not the re-serialized parsed object (see shared/types/express.d.ts).
app.use(express.json({ limit: '1mb', verify: (req, _res, buf) => { (req as express.Request).rawBody = buf; } }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(generalRateLimiter);

// 3. Health Check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json(ApiResponseHelper.success(req, getLiveness(), 'CA Firm ERP API is running'));
});

// Readiness — exercises every external dependency the app needs to serve real
// traffic (DB, Redis, SMTP, object storage). Deliberately unauthenticated and
// unrelated to /health: an orchestrator (Docker/k8s) uses this to decide
// whether to route traffic to this instance, not whether the process is alive.
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
app.use(`${API.PREFIX}/dashboard/preferences`, dashboardPreferenceRoutes);
app.use(`${API.PREFIX}/reports`, reportRoutes);

// Platform-level admin panel (PRD §4.1 "Master Login") — cross-tenant, gated by
// requireRole(MASTER_ADMIN) inside the router itself rather than tenantMiddleware.
app.use(`${API.PREFIX}/master-admin`, masterAdminRoutes);

// Platform subscription billing (PRD §12: plans, trial, Razorpay) — the tenant's OWN payment to
// this SaaS, a separate domain from `/billing/invoices|expenses|payments` above (the firm's
// billing of ITS clients). Mounted at `/subscription`, not `/billing`, to avoid colliding with
// that prefix — see modules/billing/routes/billing.routes.ts's header comment.
app.use(`${API.PREFIX}/subscription`, billingRoutes);

// General activity trail (PRD §14.1) — read-only; entries are written by
// `AuditLogRecorder` from inside other modules' own services, not through
// an endpoint of this module.
app.use(`${API.PREFIX}/audit-logs`, auditRoutes);

// White-label (PRD §4.3): tenant-scoped branding/custom-domain settings, plus the one PUBLIC
// endpoint (`/public/white-label`) an unauthenticated login page uses to resolve a hostname's
// branding before any login has happened.
app.use(`${API.PREFIX}/settings/branding`, brandingRoutes);
app.use(`${API.PREFIX}/settings/domain`, domainRoutes);
app.use(`${API.PREFIX}/public`, publicBrandingRoutes);

// 5. Global Error Handler (Must run last)
app.use(errorMiddleware);

export default app;
