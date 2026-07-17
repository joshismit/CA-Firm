import { logger, Logger } from '@config/logger';

/**
 * Base Service.
 * Provides a logger instance for all feature services.
 * Services MUST extend this class.
 *
 * RULES:
 * - Services must NOT access req/res objects
 * - Services must NOT write Prisma queries directly
 * - Services must NOT call other module controllers
 * - All business logic belongs in services
 */
export abstract class BaseService {
  protected readonly logger: Logger;

  constructor(context: string) {
    this.logger = logger.child({ context });
  }
}
