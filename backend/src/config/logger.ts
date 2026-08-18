import pino from 'pino';
import { env } from './environment';
import type { Request } from 'express';
// Type-only (erased at emit — no runtime require, `.d.ts` files have no JS to load anyway) import
// so ts-node's lazy per-file compilation actually loads this ambient `declare global` module when
// this file is required from an entry point whose own dependency graph never otherwise touches it
// (e.g. `src/workers/index.ts` — no controller/middleware in its chain references
// `RequestUser`/`RequestTenant`). Without it, `req.correlationId`/`req.tenant`/`req.user` below fail
// to type-check under `ts-node` (though not under a full `tsc` build, which always includes every
// file matching `tsconfig.json`'s `include` glob regardless).
import type {} from '@shared/types/express';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Pino Logger
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PURPOSE:
 *   Structured JSON logging for the entire application.
 *   - Development: Pretty-printed console output with colors
 *   - Production: Pure JSON for Datadog / CloudWatch / ELK
 *
 * RESPONSIBILITIES:
 *   - Automatic redaction of sensitive data (passwords, tokens, PII)
 *   - Standardized error serialization
 *   - Context binding (auto-injecting tenantId, userId, correlationId)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const logger = pino({
  level: env.LOG_LEVEL,
  ...(env.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
  redact: {
    paths: [
      'password',
      'token',
      'accessToken',
      'refreshToken',
      'secret',
      'authorization',
      'creditCard',
      'cardNumber',
      'otp',
      'pin',
      '*.password',
      '*.token',
      '*.secret',
      '*.otp',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    censor: '[REDACTED]',
  },
  base: {
    env: env.NODE_ENV,
    app: env.APP_NAME,
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

export type Logger = typeof logger;

/**
 * Creates a child logger bound to the current request context.
 * Always use this in services and controllers to ensure every log entry
 * contains the correlation ID, tenant ID, and user ID.
 *
 * @param req - The Express request object
 * @param context - The class or module name (e.g., 'AuthService')
 */
export function createContextLogger(req: Request, context: string): Logger {
  return logger.child({
    context,
    correlationId: req.correlationId,
    tenantId: req.tenant?.id,
    userId: req.user?.id,
  });
}
