import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import { Prisma } from '@prisma/client';
import { logger } from '@config/logger';
import { AppError } from '@shared/errors';
import { ApiResponseHelper } from '@shared/response/api-response';
import { HTTP_STATUS } from '@shared/constants';
import { ErrorCode } from '@shared/enums';
import { env } from '@config/environment';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Global Error Middleware
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PURPOSE:
 *   Catches ALL errors thrown across the application.
 *   Ensures that clients always receive a consistent, structured JSON response
 *   and that stack traces never leak in production.
 *
 * RESPONSIBILITIES:
 *   - Intercepts `AppError` and returns its statusCode and details.
 *   - Intercepts Zod validation errors and structures the field failures.
 *   - Intercepts Prisma database errors and masks them as operational conflicts
 *     or not-found errors (prevents leaking database internals).
 *   - Intercepts unknown crashes, logs them as 'fatal', and returns a generic 500.
 *
 * USAGE:
 *   Must be the VERY LAST middleware attached to the Express app.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
): void {
  // 1. Create a request-scoped logger
  const log = logger.child({
    correlationId: req.correlationId,
    tenantId: req.tenant?.id,
    userId: req.user?.id,
    path: req.path,
    method: req.method,
  });

  // 2. Handle Custom Operational Errors (AppError)
  if (err instanceof AppError) {
    if (err.isOperational) {
      log.warn({ err, code: err.code }, err.message);
    } else {
      // Non-operational AppError (e.g. InternalServerError) — log as error
      log.error({ err, code: err.code }, err.message);
    }

    res
      .status(err.statusCode)
      .json(ApiResponseHelper.error(req, err.message, err.code, err.details));
    return;
  }

  // 3. Handle Zod Validation Errors (if they slip past validation.middleware)
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    log.warn({ err, details }, 'Validation Error');

    res
      .status(HTTP_STATUS.UNPROCESSABLE_ENTITY)
      .json(
        ApiResponseHelper.error(
          req,
          'Validation failed',
          ErrorCode.VALIDATION_ERROR,
          details,
        ),
      );
    return;
  }

  // 3b. Handle Multer Upload Errors (file too large, unexpected field, etc.)
  if (err instanceof MulterError) {
    log.warn({ err, code: err.code }, 'File Upload Error');

    res
      .status(HTTP_STATUS.BAD_REQUEST)
      .json(ApiResponseHelper.error(req, err.message, ErrorCode.VALIDATION_ERROR));
    return;
  }

  // 4. Handle Prisma Database Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002: Unique constraint failed
    if (err.code === 'P2002') {
      log.warn({ err }, 'Prisma Unique Constraint Violation');
      res
        .status(HTTP_STATUS.CONFLICT)
        .json(
          ApiResponseHelper.error(
            req,
            'A record with this information already exists',
            ErrorCode.DUPLICATE_RECORD,
          ),
        );
      return;
    }

    // P2025: Record to update not found
    if (err.code === 'P2025') {
      log.warn({ err }, 'Prisma Record Not Found');
      res
        .status(HTTP_STATUS.NOT_FOUND)
        .json(
          ApiResponseHelper.error(
            req,
            'The requested record does not exist',
            ErrorCode.RESOURCE_NOT_FOUND,
          ),
        );
      return;
    }

    // P2003: Foreign key constraint failed
    if (err.code === 'P2003') {
      log.warn({ err }, 'Prisma Foreign Key Constraint Violation');
      res
        .status(HTTP_STATUS.CONFLICT)
        .json(
          ApiResponseHelper.error(
            req,
            'Cannot complete operation due to a missing related record',
            ErrorCode.RELATED_RECORD_NOT_FOUND,
          ),
        );
      return;
    }
  }

  // 5. Handle Unknown Errors (Programmer bugs, crashes)
  log.fatal({ err }, 'Unhandled Server Error');

  const message =
    env.NODE_ENV === 'development'
      ? err.message || 'Internal Server Error'
      : 'An unexpected error occurred. Please try again later.';

  const details = env.NODE_ENV === 'development' ? { stack: err.stack } : undefined;

  res
    .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    .json(
      ApiResponseHelper.error(
        req,
        message,
        ErrorCode.INTERNAL_SERVER_ERROR,
        details,
      ),
    );
}
