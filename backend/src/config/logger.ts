import pino from 'pino';
import { env } from './environment';

/**
 * Pino logger singleton.
 * Structured JSON logging with sensitive field redaction.
 * In development: pretty-printed with colors.
 * In production: JSON output for log aggregators (Datadog, CloudWatch, etc.)
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
