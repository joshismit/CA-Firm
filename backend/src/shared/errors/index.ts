/**
 * shared/errors — Barrel Export
 * Import from '@shared/errors' everywhere — never from individual error files.
 */
export { AppError } from './app.error';
export {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  GoneError,
  ValidationError,
  TooManyRequestsError,
  NotImplementedError,
  InternalServerError,
  ServiceUnavailableError,
} from './http.errors';
