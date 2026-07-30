import { AppError } from './app.error';
import { HTTP_STATUS } from '@shared/constants/http-status';
import { ErrorCode } from '@shared/enums';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * HTTP Error Classes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PURPOSE:
 *   Concrete error classes for every standard HTTP failure scenario.
 *   Throw these from services, repositories, and guards.
 *   The global error middleware catches and serialises them automatically.
 *
 * DESIGN:
 *   Every class:
 *   - Extends AppError (operational = true by default)
 *   - Uses HTTP_STATUS constants (no magic numbers)
 *   - Uses ErrorCode enum (no hardcoded strings)
 *   - Has sensible default messages (can be overridden)
 *   - Accepts optional `details` for structured context
 *
 * USAGE:
 *   throw new NotFoundError('Client');
 *   throw new ConflictError('A user with this email already exists', ErrorCode.EMAIL_ALREADY_EXISTS);
 *   throw new ValidationError('Validation failed', zodFieldErrors);
 *
 * FUTURE EXTENSION:
 *   Add domain-specific error classes inside their own module when
 *   they need a unique ErrorCode (e.g., PaymentFailedError in billing module).
 *   Only truly cross-module errors belong here.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── 400 Bad Request ─────────────────────────────────────────────────────────

export class BadRequestError extends AppError {
  constructor(
    message = 'Bad request',
    details?: unknown,
    code: ErrorCode = ErrorCode.BAD_REQUEST,
  ) {
    super(message, HTTP_STATUS.BAD_REQUEST, code, true, details);
  }
}

// ─── 401 Unauthorized ────────────────────────────────────────────────────────

export class UnauthorizedError extends AppError {
  constructor(
    message = 'Unauthorized',
    code: ErrorCode = ErrorCode.UNAUTHORIZED,
  ) {
    super(message, HTTP_STATUS.UNAUTHORIZED, code, true);
  }
}

// ─── 403 Forbidden ───────────────────────────────────────────────────────────

export class ForbiddenError extends AppError {
  constructor(
    message = 'Forbidden',
    code: ErrorCode = ErrorCode.FORBIDDEN,
  ) {
    super(message, HTTP_STATUS.FORBIDDEN, code, true);
  }
}

// ─── 404 Not Found ───────────────────────────────────────────────────────────

export class NotFoundError extends AppError {
  constructor(
    resource = 'Resource',
    code: ErrorCode = ErrorCode.RESOURCE_NOT_FOUND,
  ) {
    super(`${resource} not found`, HTTP_STATUS.NOT_FOUND, code, true);
  }
}

// ─── 409 Conflict ────────────────────────────────────────────────────────────

export class ConflictError extends AppError {
  constructor(
    message = 'Conflict',
    code: ErrorCode = ErrorCode.CONFLICT,
  ) {
    super(message, HTTP_STATUS.CONFLICT, code, true);
  }
}

// ─── 410 Gone ────────────────────────────────────────────────────────────────

export class GoneError extends AppError {
  constructor(
    resource = 'Resource',
    code: ErrorCode = ErrorCode.GONE,
  ) {
    super(`${resource} no longer exists`, HTTP_STATUS.GONE, code, true);
  }
}

// ─── 422 Unprocessable Entity ────────────────────────────────────────────────

export class ValidationError extends AppError {
  constructor(
    message = 'Validation failed',
    details?: unknown,
    code: ErrorCode = ErrorCode.VALIDATION_ERROR,
  ) {
    super(message, HTTP_STATUS.UNPROCESSABLE_ENTITY, code, true, details);
  }
}

// ─── 429 Too Many Requests ───────────────────────────────────────────────────

export class TooManyRequestsError extends AppError {
  constructor(
    message = 'Too many requests. Please try again later.',
    code: ErrorCode = ErrorCode.TOO_MANY_REQUESTS,
  ) {
    super(message, HTTP_STATUS.TOO_MANY_REQUESTS, code, true);
  }
}

// ─── 501 Not Implemented ─────────────────────────────────────────────────────

/**
 * A genuinely valid request for a feature that does not exist yet in this
 * backend — distinct from `InternalServerError` (an unexpected crash).
 * Always operational: the client should treat the message as authoritative,
 * not retry expecting a transient failure to resolve itself.
 */
export class NotImplementedError extends AppError {
  constructor(
    message = 'This feature is not yet available',
    code: ErrorCode = ErrorCode.NOT_IMPLEMENTED,
  ) {
    super(message, HTTP_STATUS.NOT_IMPLEMENTED, code, true);
  }
}

// ─── 500 Internal Server Error ───────────────────────────────────────────────

/**
 * Non-operational error — triggers crash monitoring in production.
 * Use for unexpected states that should NEVER happen in normal operation.
 */
export class InternalServerError extends AppError {
  constructor(
    message = 'An unexpected error occurred',
    code: ErrorCode = ErrorCode.INTERNAL_SERVER_ERROR,
  ) {
    super(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, code, false);
  }
}

// ─── 503 Service Unavailable ─────────────────────────────────────────────────

export class ServiceUnavailableError extends AppError {
  constructor(
    message = 'Service temporarily unavailable',
    code: ErrorCode = ErrorCode.SERVICE_UNAVAILABLE,
  ) {
    super(message, HTTP_STATUS.SERVICE_UNAVAILABLE, code, true);
  }
}
