import pino from 'pino';
import { env } from './environment';
import type { Request } from 'express';

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
