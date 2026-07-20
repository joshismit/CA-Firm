import pinoHttp from 'pino-http';
import { logger } from '@config/logger';
import { Request } from 'express';

/**
 * Request Logger Middleware.
 * Logs every HTTP request with:
 * - method, url, status code, response time
 * - correlationId, userId, tenantId (when available)
 * - Sensitive headers are redacted automatically
 */
export const requestLoggerMiddleware = pinoHttp({
  logger,
  genReqId: (req) => (req as Request).correlationId,
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) =>
    `${req.method} ${req.url} → ${res.statusCode}`,
  customErrorMessage: (req, res, err) =>
    `${req.method} ${req.url} → ${res.statusCode} [${err.message}]`,
  serializers: {
    req(req) {
      const expressReq = req.raw as Request;
      return {
        method: req.method,
        url: req.url,
        correlationId: expressReq.correlationId,
        userId: expressReq.user?.id,
        tenantId: expressReq.tenant?.id,
      };
    },
    res(res) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
  // Skip health check endpoints from logs
  autoLogging: {
    ignore: (req) =>
      ['/health', '/health/live', '/health/ready'].includes(req.url || ''),
  },
});
