import { AppError } from './app.error';
import { HTTP_STATUS } from '@shared/constants/http-status';

/**
 * HTTP Error Classes.
 * Throw these from services/controllers for expected error conditions.
 * The global error middleware will catch and serialize them correctly.
 */

export class BadRequestError extends AppError {
  constructor(message = 'Bad Request', details?: unknown) {
    super(message, HTTP_STATUS.BAD_REQUEST, 'BAD_REQUEST', true, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, HTTP_STATUS.UNAUTHORIZED, 'UNAUTHORIZED', true);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, HTTP_STATUS.FORBIDDEN, 'FORBIDDEN', true);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, HTTP_STATUS.NOT_FOUND, 'NOT_FOUND', true);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, HTTP_STATUS.CONFLICT, 'CONFLICT', true);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(message, HTTP_STATUS.UNPROCESSABLE_ENTITY, 'VALIDATION_ERROR', true, details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, HTTP_STATUS.TOO_MANY_REQUESTS, 'TOO_MANY_REQUESTS', true);
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal server error') {
    super(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'INTERNAL_SERVER_ERROR', false);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE', true);
  }
}
