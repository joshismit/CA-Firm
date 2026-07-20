import { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '@config/database';
import { Logger, createContextLogger } from '@config/logger';
import { NotFoundError, AppError, InternalServerError } from '@shared/errors';
import { ErrorCode } from '@shared/enums';
import { PaginationMeta } from '@shared/types';
import { ApiResponseHelper } from '@shared/response/api-response';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Base Service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PURPOSE:
 *   The foundation for all business logic services.
 *   Services must extend this class and be instantiated per-request in the controller.
 *
 * RESPONSIBILITIES:
 *   - Auto-binds a context-aware logger (`this.logger`) using the Express Request.
 *   - Provides a transaction helper for running atomic operations.
 *   - Provides `execute()` to standardize error wrapping and logging.
 *   - Provides standard utilities: `throwNotFound`, `validateExists`.
 *
 * ARCHITECTURE RULES:
 *   - Services NEVER access `res` (response). They return data or throw errors.
 *   - Services NEVER write raw Prisma queries (they call Repositories).
 *   - `this.logger` is automatically scoped with `correlationId` and `tenantId`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */
export abstract class BaseService {
  protected readonly logger: Logger;
  protected readonly req: Request;
  protected readonly tenantId?: string;
  protected readonly userId?: string;

  constructor(req: Request) {
    this.req = req;
    this.tenantId = req.tenant?.id;
    this.userId = req.user?.id;
    
    // Automatically creates a logger bound to this specific class name and request context
    this.logger = createContextLogger(req, this.constructor.name);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Transactions
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Executes a block of code inside a Prisma transaction.
   * Pass the `tx` object down to Repository methods to participate in the transaction.
   * 
   * @example
   * await this.transaction(async (tx) => {
   *   const user = await this.userRepo.create(userData, { tx });
   *   await this.profileRepo.create({ userId: user.id }, { tx });
   * });
   */
  protected async transaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return prisma.$transaction(operation);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Execution Wrapper
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Standardized wrapper for service methods.
   * Automatically logs the operation start, handles unexpected errors,
   * and prevents stack trace leakage while preserving AppErrors.
   */
  protected async execute<T>(
    operationName: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    this.logger.debug(`Executing ${operationName}`);
    try {
      const result = await operation();
      return result;
    } catch (error) {
      if (error instanceof AppError) {
        // AppErrors are intentional, pass them through
        throw error;
      }
      
      // Log unexpected crashes (Programmer errors / Bug)
      this.logger.error({ err: error }, `Operation ${operationName} failed unexpectedly`);
      
      // Mask internal errors to prevent leaking stack traces from services
      throw new InternalServerError();
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Standardised Helpers
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Validates if a record exists. If not, throws a standardized NotFoundError.
   */
  protected validateExists<T>(record: T | null | undefined, resourceName: string): asserts record is NonNullable<T> {
    if (!record) {
      this.throwNotFound(resourceName);
    }
  }

  /**
   * Throws a NotFoundError for a specific resource.
   */
  protected throwNotFound(resourceName: string, code: ErrorCode = ErrorCode.RESOURCE_NOT_FOUND): never {
    this.logger.warn(`${resourceName} not found`);
    throw new NotFoundError(resourceName, code);
  }

  /**
   * Helper to format a success response output from a service,
   * so controllers can simply: res.json(await service.doWork());
   */
  protected success<T>(data: T, message?: string) {
    return ApiResponseHelper.success(this.req, data, message);
  }

  /**
   * Helper to format a paginated response output from a service.
   */
  protected paginated<T>(data: T[], meta: PaginationMeta, message?: string) {
    return ApiResponseHelper.paginated(this.req, data, meta, message);
  }
}
