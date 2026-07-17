import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Correlation ID Middleware.
 * Assigns a unique request ID to every incoming request.
 * This ID is:
 * - Attached to req.correlationId
 * - Returned in every response header (X-Correlation-ID)
 * - Included in every log entry
 * - Stored in audit log entries
 */
export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const existingId = req.headers['x-correlation-id'] as string;
  const correlationId = existingId || uuidv4();

  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);

  next();
}
