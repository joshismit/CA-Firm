/**
 * Base AppError class.
 * All custom errors in this application extend this class.
 * Allows the global error middleware to distinguish between
 * operational errors (expected) and programmer errors (bugs).
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational = true,
    details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    // Maintains proper stack trace for where the error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}
