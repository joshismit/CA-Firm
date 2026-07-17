import { PrismaClient } from '@prisma/client';
import { prisma } from '@config/database';
import { PaginatedResult, PaginationQuery } from '@shared/types/pagination.types';
import { NotFoundError } from '@shared/errors';

/**
 * Base Repository.
 * Provides generic CRUD operations for all feature repositories.
 * Repositories MUST extend this class and add domain-specific queries.
 *
 * RULES:
 * - All Prisma queries must go through repositories
 * - Repositories must NOT contain business logic
 * - Repositories must NOT call other services
 * - Every query in a multi-tenant context MUST include tenantId filter
 */
export abstract class BaseRepository<T> {
  protected readonly prisma: PrismaClient;
  protected abstract readonly modelName: string;

  constructor() {
    this.prisma = prisma;
  }

  /**
   * Get the Prisma delegate for this model dynamically.
   * Subclasses can override this or use typed methods directly.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected get model(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.prisma as any)[this.modelName];
  }

  /**
   * Build pagination skip/take from query params
   */
  protected buildPaginationParams(query: PaginationQuery): {
    skip: number;
    take: number;
    orderBy: Record<string, string>;
  } {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    return {
      skip: (page - 1) * limit,
      take: limit,
      orderBy: query.sortBy
        ? { [query.sortBy]: query.sortOrder || 'desc' }
        : { createdAt: 'desc' },
    };
  }

  /**
   * Build paginated result from data and count
   */
  protected buildPaginatedResult<D>(
    data: D[],
    total: number,
    query: PaginationQuery,
  ): PaginatedResult<D> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
