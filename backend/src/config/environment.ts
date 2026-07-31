import { z } from 'zod';

/**
 * Environment variable schema.
 * All environment variables MUST be declared here.
 * This is the ONLY place where process.env is accessed.
 * Server fails to start if any required variable is missing or invalid.
 */
const envSchema = z.object({
  // ─── App ─────────────────────────────────────────────────────────────────
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  APP_NAME: z.string().default('CAFirmERP'),
  APP_PORT: z.coerce.number().default(4000),
  APP_URL: z.string().url().default('http://localhost:4000'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  API_PREFIX: z.string().default('/api/v1'),
  /** The platform's own base domain — a tenant's subdomain white-label URL is `<subdomain>.<PLATFORM_DOMAIN>`
   *  (PRD §4.3's "firmname.yourdomain.com" example). `localhost` in dev: modern browsers/OS resolvers treat
   *  any `*.localhost` hostname as loopback (RFC 6761), so subdomain white-labeling is genuinely testable
   *  locally without editing `/etc/hosts` or configuring real DNS. */
  PLATFORM_DOMAIN: z.string().default('localhost'),

  // ─── Database ────────────────────────────────────────────────────────────
  DATABASE_URL: z.string().url(),

  // ─── Redis ───────────────────────────────────────────────────────────────
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),

  // ─── JWT ─────────────────────────────────────────────────────────────────
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // ─── Storage (AWS S3 / Cloudflare R2) ────────────────────────────────────
  STORAGE_PROVIDER: z.enum(['s3', 'r2', 'local']).default('local'),
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_BUCKET_NAME: z.string().optional(),
  AWS_ENDPOINT_URL: z.string().url().optional(), // For Cloudflare R2

  // ─── Mail ────────────────────────────────────────────────────────────────
  MAIL_HOST: z.string().default('localhost'),
  MAIL_PORT: z.coerce.number().default(587),
  MAIL_USER: z.string().optional(),
  MAIL_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().email().default('noreply@cafirm.com'),
  MAIL_FROM_NAME: z.string().default('CA Firm ERP'),

  // ─── WhatsApp (PRD §11.1) ────────────────────────────────────────────────
  // No default URL/token — unlike Mail, there is no "always works against
  // localhost" fallback for a WhatsApp Business API. All optional; absence
  // means `WhatsAppProvider.isConfigured` is false and sends are rejected
  // before any network call, mirroring `razorpayConfig.isConfigured`.
  WHATSAPP_API_URL: z.string().url().optional(),
  WHATSAPP_API_TOKEN: z.string().optional(),
  WHATSAPP_SENDER_ID: z.string().optional(),

  // ─── SMS (PRD §11.3 — "configurable provider-based option") ─────────────
  SMS_API_URL: z.string().url().optional(),
  SMS_API_KEY: z.string().optional(),
  SMS_SENDER_ID: z.string().optional(),

  // ─── Logging ─────────────────────────────────────────────────────────────
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // ─── Rate Limiting ───────────────────────────────────────────────────────
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000), // 15 minutes
  RATE_LIMIT_MAX: z.coerce.number().default(100),

  // ─── Master Admin ────────────────────────────────────────────────────────
  MASTER_ADMIN_EMAIL: z.string().email().optional(),
  MASTER_ADMIN_PASSWORD: z.string().min(8).optional(),

  // ─── Razorpay (platform subscription billing) ───────────────────────────
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  /** Configured separately in the Razorpay dashboard against a public webhook URL — optional
   *  because local dev has no such URL; checkout still works via `validatePaymentVerification()`
   *  on the client's own success callback (see modules/billing/service/billing.service.ts). */
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  // ─── Swagger ─────────────────────────────────────────────────────────────
  ENABLE_SWAGGER: z.coerce.boolean().default(true),
});

export type Env = z.infer<typeof envSchema>;

const _parsedResult = envSchema.safeParse(process.env);

if (!_parsedResult.success) {
  console.error('❌  Invalid environment variables:');
  console.error(_parsedResult.error.flatten().fieldErrors);
  process.exit(1);
}

export const env: Env = _parsedResult.data;
