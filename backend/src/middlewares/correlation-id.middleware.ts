import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Correlation ID Middleware
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PURPOSE:
 *   Assigns a unique request identifier and start timestamp to every
 *   incoming HTTP request before any other middleware runs.
 *
 * RESPONSIBILITIES:
 *   - Generates (or inherits) a UUID v4 per request
 *   - Attaches `req.correlationId` for downstream use in logs and error responses
 *   - Attaches `req.requestStartTime` (Unix ms) for response duration calculation
 *   - Sets `X-Correlation-ID` response header so clients can trace requests
 *
 * DESIGN DECISION:
 *   If the upstream caller (API gateway, load balancer, or another service)
 *   already provides an `x-correlation-id` header, we reuse it. This enables
 *   distributed request tracing across microservices or frontend-to-backend flows.
 *
 * USAGE:
 *   app.use(correlationIdMiddleware); // Must be FIRST middleware in the chain
 *
 * FUTURE EXTENSION:
 *   When OpenTelemetry tracing is added, extract the W3C `traceparent` header
 *   here and propagate it to the Pino logger's `traceId` field.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Inherit from upstream if present (API gateway / distributed tracing)
  const existingId = req.headers['x-correlation-id'];
  const correlationId = (Array.isArray(existingId) ? existingId[0] : existingId) ?? uuidv4();

  // Attach to request — available in every downstream middleware and controller
  req.correlationId = correlationId;

  // Record request start time — used to compute duration in error handler / logger
  req.requestStartTime = Date.now();

  // Return to client so they can correlate their logs with ours
  res.setHeader('X-Correlation-ID', correlationId);

  next();
}
