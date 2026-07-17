# CA Firm ERP — Backend Architecture Blueprint
> Principal Architect Design | Production-Grade Multi-Tenant SaaS | Node.js + Express + TypeScript + Prisma

---

## 1. Backend Architecture Overview

This backend serves a **multi-tenant, role-based SaaS ERP** for Chartered Accountant firms in India. It is designed for a **10+ year product lifecycle**, maintained by multiple developers, with zero compromise on security, scalability, or maintainability.

The architecture combines three proven patterns:
- **Feature-Based Architecture** — organizes code by business domain, not technical role
- **Clean Architecture** — enforces strict dependency direction (outer → inner)
- **Layered Architecture** — Controller → Service → Repository → Database

---

## 2. Backend Folder Structure

```
backend/
├── src/
│   ├── config/                    # All configuration files (env-validated)
│   │   ├── environment.ts         # Zod-validated env vars (single source of truth)
│   │   ├── database.ts            # Prisma client singleton
│   │   ├── redis.ts               # IORedis client singleton
│   │   ├── jwt.ts                 # JWT secrets and expiry config
│   │   ├── storage.ts             # AWS S3 / Cloudflare R2 client
│   │   ├── queue.ts               # BullMQ queue definitions
│   │   ├── mail.ts                # Nodemailer transport
│   │   ├── logger.ts              # Pino logger singleton
│   │   └── swagger.ts             # OpenAPI / Swagger setup
│   │
│   ├── modules/                   # Feature-based business modules
│   │   ├── auth/
│   │   ├── tenant/
│   │   ├── users/
│   │   ├── roles/
│   │   ├── permissions/
│   │   ├── clients/
│   │   ├── business/
│   │   ├── contacts/
│   │   ├── documents/
│   │   ├── crm/
│   │   ├── tasks/
│   │   ├── notifications/
│   │   ├── payments/
│   │   ├── audit/
│   │   ├── reports/
│   │   ├── dashboard/
│   │   ├── settings/
│   │   ├── subscriptions/
│   │   └── master-admin/
│   │
│   ├── middlewares/               # Global Express middlewares
│   │   ├── auth.middleware.ts
│   │   ├── tenant.middleware.ts
│   │   ├── permission.middleware.ts
│   │   ├── validation.middleware.ts
│   │   ├── rate-limit.middleware.ts
│   │   ├── correlation-id.middleware.ts
│   │   ├── request-logger.middleware.ts
│   │   └── error.middleware.ts
│   │
│   ├── shared/                    # Cross-cutting concerns (NO business logic)
│   │   ├── base/
│   │   │   ├── base.repository.ts
│   │   │   └── base.service.ts
│   │   ├── errors/
│   │   │   ├── app.error.ts
│   │   │   ├── http.errors.ts
│   │   │   └── index.ts
│   │   ├── response/
│   │   │   ├── api-response.ts
│   │   │   └── response.helper.ts
│   │   ├── constants/
│   │   │   ├── http-status.ts
│   │   │   ├── messages.ts
│   │   │   └── index.ts
│   │   ├── enums/
│   │   │   ├── user.enum.ts
│   │   │   ├── permission.enum.ts
│   │   │   └── index.ts
│   │   ├── interfaces/
│   │   │   ├── repository.interface.ts
│   │   │   ├── service.interface.ts
│   │   │   └── index.ts
│   │   ├── types/
│   │   │   ├── express.d.ts        # Augment Express Request type
│   │   │   ├── pagination.types.ts
│   │   │   └── index.ts
│   │   ├── validators/
│   │   │   ├── common.validators.ts
│   │   │   └── index.ts
│   │   └── utils/
│   │       ├── crypto.utils.ts
│   │       ├── date.utils.ts
│   │       ├── string.utils.ts
│   │       └── index.ts
│   │
│   ├── workers/                   # BullMQ background job processors
│   │   ├── email.worker.ts
│   │   ├── notification.worker.ts
│   │   ├── report.worker.ts
│   │   └── index.ts
│   │
│   ├── storage/                   # File storage abstraction
│   │   ├── s3.client.ts
│   │   ├── storage.service.ts
│   │   └── index.ts
│   │
│   ├── routes/
│   │   └── index.ts               # Root router — mounts all module routes
│   │
│   ├── types/
│   │   └── index.ts               # Global type re-exports
│   │
│   ├── app.ts                     # Express app configuration
│   └── server.ts                  # HTTP server + graceful shutdown
│
├── prisma/
│   ├── schema.prisma              # Prisma schema definition
│   ├── migrations/                # Auto-generated migration files
│   └── seeds/
│       ├── index.ts               # Seed orchestrator
│       └── master-admin.seed.ts   # Initial master admin seed
│
├── tests/
│   ├── unit/                      # Unit tests (per module)
│   ├── integration/               # Integration tests (DB + Redis)
│   └── e2e/                       # End-to-end API tests
│
├── scripts/
│   ├── migrate.ts                 # Migration runner
│   ├── seed.ts                    # Seed runner
│   └── generate-keys.ts           # Key generation utility
│
├── logs/                          # Runtime logs (gitignored)
│   └── .gitkeep
│
├── uploads/                       # Dev-only local uploads (gitignored)
│   └── .gitkeep
│
├── .env.example                   # Committed — template with all keys
├── .env.development               # Local dev (gitignored)
├── .env.staging                   # Staging (gitignored)
├── .env.production                # Production (gitignored)
├── Dockerfile                     # Production Docker image
├── docker-compose.yml             # Production compose
├── docker-compose.dev.yml         # Development compose
├── .dockerignore
├── tsconfig.json
├── package.json
├── nodemon.json
└── README.md
```

---

## 3. Module Architecture

Every feature module follows a **consistent internal structure**. This ensures any developer can navigate any module without learning a new pattern.

```
modules/
└── auth/                          # Example module
    ├── controller/
    │   └── auth.controller.ts     # HTTP handlers ONLY. No business logic.
    ├── service/
    │   └── auth.service.ts        # All business logic. No DB access.
    ├── repository/
    │   └── auth.repository.ts     # All Prisma queries. No business logic.
    ├── routes/
    │   └── auth.routes.ts         # Route definitions + middleware attachment
    ├── dto/
    │   ├── login.dto.ts           # Data Transfer Objects (typed inputs)
    │   └── register.dto.ts
    ├── schemas/
    │   ├── login.schema.ts        # Zod schemas for validation
    │   └── register.schema.ts
    ├── types/
    │   └── auth.types.ts          # Module-specific TypeScript types
    ├── constants/
    │   └── auth.constants.ts      # Module-specific constants
    ├── permissions/
    │   └── auth.permissions.ts    # Permission keys for this module
    ├── events/
    │   └── auth.events.ts         # Domain event definitions
    ├── mapper/
    │   └── auth.mapper.ts         # Maps DB models → DTOs
    └── index.ts                   # Public barrel export
```

### Folder Responsibilities

| Folder | Responsibility |
|--------|---------------|
| `controller/` | Parse HTTP request, call service, return HTTP response |
| `service/` | Business logic, orchestration, no HTTP/DB knowledge |
| `repository/` | All Prisma queries, data access layer |
| `routes/` | Register routes, attach middleware, wire controller methods |
| `dto/` | TypeScript interfaces for request/response shapes |
| `schemas/` | Zod schemas that validate and parse input |
| `types/` | Module-specific TypeScript types and interfaces |
| `constants/` | Magic strings, config values scoped to this module |
| `permissions/` | Permission keys used in RBAC for this module |
| `events/` | Domain event types emitted by this module |
| `mapper/` | Transform Prisma model → DTO, never expose raw DB models |

---

## 4. Shared Layer Structure

The `shared/` folder contains cross-cutting concerns that are **reused across all modules** but contain **zero business logic**.

```
shared/
├── base/
│   ├── base.repository.ts     # Generic Prisma CRUD operations
│   └── base.service.ts        # Base class with logger injection
│
├── errors/
│   ├── app.error.ts           # Base AppError class
│   ├── http.errors.ts         # NotFoundError, UnauthorizedError, etc.
│   └── index.ts
│
├── response/
│   ├── api-response.ts        # Standardized ApiResponse<T> type
│   └── response.helper.ts     # success(), error(), paginated() helpers
│
├── constants/
│   ├── http-status.ts         # HTTP status code constants
│   ├── messages.ts            # Common response messages
│   └── index.ts
│
├── enums/
│   ├── user.enum.ts           # UserRole, UserStatus
│   ├── permission.enum.ts     # Action, Resource enums
│   └── index.ts
│
├── interfaces/
│   ├── repository.interface.ts  # IRepository<T> contract
│   ├── service.interface.ts     # IService<T> contract
│   └── index.ts
│
├── types/
│   ├── express.d.ts            # Augments Request with user, tenant, correlationId
│   ├── pagination.types.ts     # PaginatedResult<T>, PaginationQuery
│   └── index.ts
│
├── validators/
│   ├── common.validators.ts    # Reusable Zod schemas (UUID, email, date, etc.)
│   └── index.ts
│
└── utils/
    ├── crypto.utils.ts         # Hash, compare, token generation
    ├── date.utils.ts           # Date formatting, timezone
    ├── string.utils.ts         # Slug, sanitize, truncate
    └── index.ts
```

---

## 5. Configuration Structure

All config files load from environment variables validated by Zod. **No raw `process.env` access outside `config/environment.ts`**.

```
config/
├── environment.ts    # Single source of truth — Zod parses & validates ALL env vars
├── database.ts       # Prisma client with connection pooling
├── redis.ts          # IORedis with retry strategy
├── jwt.ts            # Access/Refresh token secrets + expiry
├── storage.ts        # S3/R2 client with bucket config
├── queue.ts          # BullMQ queue instances with Redis connection
├── mail.ts           # Nodemailer SMTP transport
├── logger.ts         # Pino logger with redaction config
└── swagger.ts        # OpenAPI definition + Swagger UI setup
```

**Config Loading Rule:** `environment.ts` is imported first. All other config files import from `environment.ts`. This ensures fail-fast on startup if any required env var is missing.

---

## 6. Request Lifecycle

```
Client Request
      │
      ▼
  [Nginx]
  Rate limiting, SSL termination, proxy headers
      │
      ▼
  [Express App]
      │
      ▼
  [Global Middleware Stack]
  ├── Helmet         → Security headers
  ├── CORS           → Origin validation
  ├── Compression    → Gzip responses
  ├── CorrelationID  → Attach X-Request-ID
  └── RequestLogger  → Pino HTTP logging
      │
      ▼
  [Route Matching]
  express router → module routes
      │
      ▼
  [Validation Middleware]
  Zod schema → parse body/params/query
  → 422 on failure
      │
      ▼
  [Auth Middleware]
  Verify JWT → decode payload → attach req.user
  → 401 on failure
      │
      ▼
  [Tenant Middleware]
  Extract tenant from JWT / subdomain / header
  → attach req.tenant
  → 403 if tenant inactive/not found
      │
      ▼
  [Permission Middleware]
  Check req.user.role permissions for this route
  → 403 if unauthorized
      │
      ▼
  [Rate Limit Middleware]
  Per-tenant / per-user rate limiting via Redis
  → 429 if exceeded
      │
      ▼
  [Controller]
  Extract req data → call service → format response
      │
      ▼
  [Service]
  Business logic → call repository → return result
      │
      ▼
  [Repository]
  Prisma queries → return raw data
      │
      ▼
  [PostgreSQL]
      │
      ▼
  [Response Helper]
  Standardized ApiResponse<T> → JSON
      │
      ▼
  Client Response
```

### Why Each Layer Exists

| Layer | Reason |
|-------|--------|
| Nginx | SSL, rate limiting, load balancing — keep Express lean |
| Helmet | Prevent common web vulnerabilities at header level |
| CorrelationID | Trace requests across logs, services, workers |
| Validation | Reject malformed input before it reaches business logic |
| Auth | Verify identity before any resource access |
| Tenant | Resolve which tenant's data scope this request belongs to |
| Permission | Enforce RBAC — what this user can do in this tenant |
| Rate Limit | Protect against abuse and DDoS per tenant/user |
| Controller | HTTP adapter — translate HTTP ↔ service calls |
| Service | Where business rules live — testable, framework-agnostic |
| Repository | Data access abstraction — swap Prisma without changing services |

---

## 7. Dependency Rules

```
┌─────────────────────────────────────┐
│  Controllers (HTTP Layer)           │
│  • Parse req, call service          │
│  • Return HTTP response             │
│  ✅ May access: Service             │
│  ❌ Must NOT: Use Prisma directly   │
│  ❌ Must NOT: Contain business logic│
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Services (Business Logic Layer)    │
│  • Business rules & orchestration   │
│  • Call repositories                │
│  ✅ May access: Repository, Events  │
│  ❌ Must NOT: Access req/res objects│
│  ❌ Must NOT: Write Prisma queries  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Repositories (Data Access Layer)   │
│  • All Prisma queries               │
│  • Return plain objects/arrays      │
│  ✅ May access: Prisma Client       │
│  ❌ Must NOT: Contain business logic│
│  ❌ Must NOT: Call other services   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Prisma ORM → PostgreSQL            │
└─────────────────────────────────────┘
```

### Architecture Rules (Non-Negotiable)

1. **Controllers never touch Prisma.** All DB access goes through Repository.
2. **Services never touch `req` or `res`.** They are HTTP-framework agnostic.
3. **Repositories never contain business logic.** Only data operations.
4. **No circular dependencies between modules.** Shared logic goes to `shared/`.
5. **No raw `process.env` outside `config/environment.ts`.**
6. **All inputs validated at the route layer** before reaching controllers.
7. **Never expose Prisma models to the client.** Always map through `mapper/`.
8. **Workers must not call controllers.** Workers call services directly.
9. **Events are the only cross-module communication mechanism.**
10. **Shared utilities must be stateless and pure functions.**

---

## 8. Error Handling Strategy

### Error Class Hierarchy

```
Error (native)
└── AppError (base custom error)
    ├── BadRequestError         (400)
    ├── UnauthorizedError       (401)
    ├── ForbiddenError          (403)
    ├── NotFoundError           (404)
    ├── ConflictError           (409)
    ├── ValidationError         (422)
    ├── TooManyRequestsError    (429)
    └── InternalServerError     (500)
```

### Standardized API Response Format

**Success:**
```json
{
  "success": true,
  "message": "Clients fetched successfully",
  "data": { ... },
  "meta": { "page": 1, "total": 100 }
}
```

**Error:**
```json
{
  "success": false,
  "message": "Resource not found",
  "error": {
    "code": "NOT_FOUND",
    "details": []
  },
  "correlationId": "uuid-v4"
}
```

### Global Error Middleware

The last middleware in Express catches all thrown errors:
- `AppError` instances → structured JSON response
- Zod `ZodError` → mapped to 422 ValidationError
- Prisma errors → mapped to appropriate HTTP codes
- Unknown errors → 500 with sanitized message (no stack in production)

---

## 9. Logging Strategy

Uses **Pino** for structured JSON logging.

### Log Levels

| Level | When |
|-------|------|
| `trace` | Detailed debugging (dev only) |
| `debug` | Development debugging |
| `info` | Normal operations, request logs |
| `warn` | Recoverable issues, deprecation |
| `error` | Errors that affect functionality |
| `fatal` | Unrecoverable, server shutting down |

### Log Types

```
Request Logs     → pino-http: method, url, status, duration, correlationId
Error Logs       → error, stack, correlationId, userId, tenantId
Audit Logs       → who did what, when, on which resource (stored in DB)
Performance Logs → slow query warnings (> 1000ms)
Worker Logs      → job ID, queue, status, duration
```

### Correlation ID

Every request gets a `X-Correlation-ID` header (UUID v4). This ID is:
- Attached to `req.correlationId`
- Included in every log entry
- Returned in error responses
- Passed to BullMQ jobs
- Stored in audit log entries

### Log Redaction (Pino)

Never log: `password`, `token`, `secret`, `authorization`, `creditCard`, `otp`

---

## 10. Validation Strategy

Uses **Zod** exclusively. No manual validation.

```
Body Validation     → req.body      → validated in validation.middleware.ts
Params Validation   → req.params    → validated in validation.middleware.ts
Query Validation    → req.query     → validated in validation.middleware.ts
Env Validation      → process.env   → validated in config/environment.ts at startup
DTO Validation      → service layer → Zod .parse() / .safeParse()
```

### Validation Middleware Factory

```typescript
validate(schema: { body?, params?, query? })
// → Creates a middleware that runs Zod on the specified parts
// → Returns 422 with field-level error details on failure
// → Replaces req.body with parsed (typed) object on success
```

---

## 11. Environment Configuration

### Files

| File | Purpose | Committed? |
|------|---------|-----------|
| `.env.example` | Template with all keys (no values) | ✅ Yes |
| `.env.development` | Local development values | ❌ No |
| `.env.staging` | Staging server values | ❌ No |
| `.env.production` | Production server values | ❌ No |

### Naming Conventions

```
# App
NODE_ENV=development
APP_NAME=CAFirmERP
APP_PORT=4000
APP_URL=http://localhost:4000
FRONTEND_URL=http://localhost:5173
API_PREFIX=/api/v1

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/cafirm_dev

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_ACCESS_SECRET=<min-32-chars>
JWT_REFRESH_SECRET=<min-32-chars>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# AWS S3 / Cloudflare R2
STORAGE_PROVIDER=s3
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_BUCKET_NAME=
AWS_ENDPOINT_URL=          # For R2 compatibility

# Mail
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=
MAIL_PASSWORD=
MAIL_FROM=noreply@cafirm.com

# Master Admin
MASTER_ADMIN_EMAIL=
MASTER_ADMIN_PASSWORD=

# Logging
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

---

## 12. Development Standards

### Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Folders | kebab-case | `master-admin/`, `auth/` |
| Files | kebab-case + type suffix | `auth.service.ts`, `login.dto.ts` |
| Classes | PascalCase | `AuthService`, `BaseRepository` |
| Interfaces | PascalCase with `I` prefix | `IRepository<T>`, `IAuthService` |
| Enums | PascalCase | `UserRole`, `PermissionAction` |
| Enum values | SCREAMING_SNAKE_CASE | `UserRole.SUPER_ADMIN` |
| DTOs | PascalCase + `Dto` suffix | `LoginDto`, `CreateClientDto` |
| Schemas | camelCase + `Schema` suffix | `loginSchema`, `createClientSchema` |
| Services | PascalCase + `Service` suffix | `AuthService`, `ClientService` |
| Repositories | PascalCase + `Repository` suffix | `AuthRepository` |
| Controllers | PascalCase + `Controller` suffix | `AuthController` |
| Events | SCREAMING_SNAKE_CASE | `USER_CREATED`, `TENANT_ACTIVATED` |
| Middlewares | camelCase + `Middleware` suffix | `authMiddleware`, `tenantMiddleware` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_LOGIN_ATTEMPTS`, `OTP_EXPIRY` |
| Type aliases | PascalCase | `PaginatedResult<T>`, `JwtPayload` |
| Hooks/Utils | camelCase | `hashPassword()`, `formatDate()` |

---

## 13. Testing Strategy

### Structure

```
tests/
├── unit/
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.service.spec.ts
│   │   │   └── auth.repository.spec.ts
│   │   └── ...
│   └── shared/
│       ├── response.helper.spec.ts
│       └── crypto.utils.spec.ts
│
├── integration/
│   ├── auth.integration.spec.ts
│   └── tenant.integration.spec.ts
│
└── e2e/
    ├── auth.e2e.spec.ts
    └── ...
```

### Testing Rules

| Test Type | What | Tools |
|-----------|------|-------|
| Unit | Services, utilities, mappers — mocked deps | Jest + ts-jest |
| Integration | Repository + real DB (test DB) | Jest + Prisma test client |
| E2E | Full HTTP request → response via Supertest | Jest + Supertest |
| Worker | BullMQ job processing | Jest + mock queues |

---

## 14. Deployment Ready Structure

### Dockerfile (Multi-stage)

```
Stage 1: deps     → Install production dependencies
Stage 2: builder  → Compile TypeScript → dist/
Stage 3: runner   → Copy dist + node_modules → minimal image
```

### Docker Compose (Production)

```
services:
  api       → Node.js backend (built image)
  postgres  → PostgreSQL 16
  redis     → Redis 7
  nginx     → Reverse proxy + SSL termination
```

### Health Checks

```
GET /health         → Basic liveness check
GET /health/ready   → Readiness (DB + Redis connection)
GET /health/live    → Liveness probe
```

### CI/CD Preparation

```
.github/workflows/
├── ci.yml          → Lint + Test on PR
├── deploy-staging.yml
└── deploy-production.yml
```

---

## 15. Best Practices

1. **Fail Fast** — Validate all env vars at startup. Server must not start with missing config.
2. **Graceful Shutdown** — Handle SIGTERM/SIGINT. Drain requests, close DB/Redis connections.
3. **No Magic Strings** — Use constants and enums everywhere.
4. **One Prisma Instance** — Singleton pattern. Never instantiate `PrismaClient` in modules.
5. **Never Trust Client Input** — Every route validates through Zod before business logic.
6. **Tenant Isolation** — Every Prisma query in a multi-tenant context MUST include `tenantId` filter. Never rely on application logic alone.
7. **Audit Everything** — Log who, what, when for all write operations. Non-negotiable.
8. **No Secrets in Code** — Zero hardcoded credentials. All from env vars.
9. **Idempotent Workers** — BullMQ jobs must be idempotent. Safe to retry on failure.
10. **API Versioning** — All routes under `/api/v1`. Namespace before you need it.
11. **Pagination by Default** — All list endpoints must be paginated. No unlimited queries.
12. **Soft Deletes** — Use `deletedAt: DateTime?` on critical entities. Never hard delete client data.
13. **DTO Mapping** — Always map Prisma models to DTOs before returning. Never expose raw DB models.
14. **Index Critical Columns** — `tenantId`, `userId`, `email`, `createdAt`, `status` must be indexed.
15. **Rate Limit per Tenant** — Prevent one tenant from starving others. Store counters in Redis.
