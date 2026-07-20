import { ErrorCode } from '@shared/enums';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * AppError — Base Custom Error Class
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PURPOSE:
 *   The root of the custom error hierarchy.
 *   All application-thrown errors extend this class.
 *
 * RESPONSIBILITIES:
 *   - Distinguishes between operational errors (expected: 4xx, known 5xx)
 *     and programmer errors (bugs: unexpected crashes, null refs, etc.)
 *   - Carries a machine-readable `ErrorCode` enum value for client branching
 *   - Carries structured `details` for field-level validation feedback
 *   - Preserves the correct stack trace origin
 *
 * DESIGN:
 *   `isOperational = true`  → The error middleware sends a structured JSON response.
 *   `isOperational = false` → The error middleware treats it as an unhandled crash
 *                             and may trigger a process restart in production.
 *
 * USAGE:
 *   // Throw a known operational error
 *   throw new AppError('Custom message', 409, ErrorCode.CONFLICT);
 *
 *   // Extend for a new domain-specific error
 *   export class PaymentFailedError extends AppError {
 *     constructor(reason: string) {
 *       super(reason, 402, ErrorCode.PAYMENT_REQUIRED);
 *     }
 *   }
 *
 * FUTURE EXTENSION:
 *   - Add `i18nKey` for internationalized error messages when multi-language is needed.
 *   - Add `retryable: boolean` flag for the client SDK to decide whether to retry.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class AppError extends Error {
  /** HTTP status code to send */
  public readonly statusCode: number;

  /** Machine-readable error code from ErrorCode enum */
  public readonly code: ErrorCode;

  /**
   * `true`  → operational error (expected failure, return structured JSON)
   * `false` → programmer error (unexpected crash, may trigger process restart)
   */
  public readonly isOperational: boolean;

  /** Optional structured detail payload (e.g., Zod field errors) */
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number,
    code: ErrorCode,
    isOperational = true,
    details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    // Preserves the correct file/line in the stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}
