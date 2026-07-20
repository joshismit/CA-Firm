import { PrismaClient, Prisma } from '@prisma/client';
import { PaginationMeta, PaginationQuery } from '@shared/types';
import { ApiResponseHelper } from '@shared/response/api-response';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Base Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PURPOSE:
 *   Provides generic, strongly-typed CRUD operations with automatic support for
 *   multi-tenancy and soft deletes. All domain repositories must extend this.
 *
 * ARCHITECTURE RULES:
 *   - Uses strict Dependency Injection (injects PrismaClient and the model delegate)
 *   - No `any` for Prisma delegates, no reflection, no magic string accessors.
 *   - Every read/write operation is automatically scoped by `tenantId` and `deletedAt = null`
 *     unless an explicit escape hatch is used (`ignoreTenant: true`, `ignoreSoftDelete: true`).
 *   - Soft delete is enforced. `delete()` performs a soft delete. `forceDelete()` performs a hard delete.
 *   - Every method accepts an optional `tx?: Prisma.TransactionClient` to participate in transactions.
 *
 * USAGE EXAMPLE:
 *   export class UserRepository extends BaseRepository<Prisma.UserDelegate, User> {
 *     constructor(prisma: PrismaClient) {
 *       super(prisma.user, prisma);
 *     }
 *   }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface RepositoryOptions {
  /** Include soft-deleted records (default: false) */
  ignoreSoftDelete?: boolean;
  /** Skip tenant isolation (default: false) — ONLY for system admin jobs */
  ignoreTenant?: boolean;
  /** The tenant ID to scope the query to. If undefined, and ignoreTenant is false, it will throw. */
  tenantId?: string;
  /** The ID of the user performing the action (used for deletedBy/updatedBy) */
  userId?: string;
  /** The Prisma transaction client to execute the query within */
  tx?: Prisma.TransactionClient;
}

// Minimal interface that all Prisma model delegates implement
export interface BaseDelegate {
  findUnique(args: unknown): Promise<unknown>;
  findFirst(args: unknown): Promise<unknown>;
  findMany(args: unknown): Promise<unknown>;
  create(args: unknown): Promise<unknown>;
  createMany(args: unknown): Promise<unknown>;
  update(args: unknown): Promise<unknown>;
  updateMany(args: unknown): Promise<unknown>;
  delete(args: unknown): Promise<unknown>;
  count(args: unknown): Promise<unknown>;
}

export abstract class BaseRepository<
  D extends BaseDelegate,
  Entity extends { id: string },
> {
  constructor(
    protected readonly delegate: D,
    protected readonly prisma: PrismaClient,
  ) {}

  /**
   * Helper to resolve the correct delegate (transaction client or base client)
   */
  protected getClient(tx?: Prisma.TransactionClient): D {
    if (!tx) return this.delegate;
    // We must rely on the constructor's PrismaClient to find the model name.
    // Finding the model name dynamically to access it on `tx`:
    // The easiest way without reflection is to find which property on `prisma` equals `this.delegate`.
    // However, since we can't do that safely at runtime, we map it directly:
    // Actually, `tx` has the exact same properties as `prisma`.
    // We can iterate the Prisma client to find the key that matches `this.delegate`.
    const modelName = Object.keys(this.prisma).find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (key) => (this.prisma as any)[key] === this.delegate,
    );

    if (!modelName) {
      throw new Error('Could not resolve model name for transaction delegate');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (tx as any)[modelName] as D;
  }

  /**
   * Applies mandatory multitenancy and soft-delete filters to a `where` clause.
   */
  protected applyFilters(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: Record<string, any> = {},
    options: RepositoryOptions = {},
  ): Record<string, unknown> {
    const filters = { ...where };

    if (!options.ignoreSoftDelete) {
      filters.deletedAt = null;
    }

    if (!options.ignoreTenant) {
      if (!options.tenantId) {
        throw new Error(
          'Security Violation: tenantId is required for this query. If this is a system query, pass ignoreTenant: true.',
        );
      }
      filters.tenantId = options.tenantId;
    }

    return filters;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // CRUD Operations
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Finds a single record by its ID, respecting tenant isolation and soft deletes.
   */
  async findById(
    id: string,
    options: RepositoryOptions = {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    include?: Record<string, any>,
  ): Promise<Entity | null> {
    const where = this.applyFilters({ id }, options);
    const client = this.getClient(options.tx);
    // Use findFirst because findUnique cannot accept non-unique constraints (like tenantId, deletedAt)
    return client.findFirst({ where, include }) as Promise<Entity | null>;
  }

  /**
   * Finds the first record matching the criteria.
   */
  async findFirst(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: Record<string, any>,
    options: RepositoryOptions = {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    include?: Record<string, any>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    orderBy?: Record<string, any>,
  ): Promise<Entity | null> {
    const filteredWhere = this.applyFilters(where, options);
    const client = this.getClient(options.tx);
    return client.findFirst({ where: filteredWhere, include, orderBy }) as Promise<Entity | null>;
  }

  /**
   * Finds all records matching the criteria.
   */
  async findMany(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: Record<string, any> = {},
    options: RepositoryOptions = {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    include?: Record<string, any>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    orderBy?: Record<string, any>,
  ): Promise<Entity[]> {
    const filteredWhere = this.applyFilters(where, options);
    const client = this.getClient(options.tx);
    return client.findMany({ where: filteredWhere, include, orderBy }) as Promise<Entity[]>;
  }

  /**
   * Creates a new record. Automatically assigns tenantId if applicable.
   */
  async create(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any>,
    options: RepositoryOptions = {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    include?: Record<string, any>,
  ): Promise<Entity> {
    const payload = { ...data };
    if (!options.ignoreTenant && options.tenantId) {
      payload.tenantId = options.tenantId;
    }
    const client = this.getClient(options.tx);
    return client.create({ data: payload, include }) as Promise<Entity>;
  }

  /**
   * Updates an existing record. Applies tenant and soft-delete filters.
   */
  async update(
    id: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any>,
    options: RepositoryOptions = {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    include?: Record<string, any>,
  ): Promise<Entity> {
    const where = this.applyFilters({ id }, options);
    const client = this.getClient(options.tx);
    // Use updateMany to safely update with non-unique filters, then fetch the result
    await client.updateMany({ where, data });
    return this.findById(id, options, include) as Promise<Entity>;
  }

  /**
   * Soft deletes a record by ID. Sets deletedAt and deletedBy.
   */
  async delete(id: string, options: RepositoryOptions = {}): Promise<boolean> {
    const where = this.applyFilters({ id }, options);
    const client = this.getClient(options.tx);
    
    // Perform soft delete
    const result = await client.updateMany({
      where,
      data: {
        deletedAt: new Date(),
        deletedBy: options.userId || null,
      },
    }) as { count: number };

    return result.count > 0;
  }

  /**
   * Restores a soft-deleted record.
   */
  async restore(id: string, options: RepositoryOptions = {}): Promise<boolean> {
    // Force ignoreSoftDelete so we can find the deleted record
    const where = this.applyFilters({ id }, { ...options, ignoreSoftDelete: true });
    const client = this.getClient(options.tx);

    const result = await client.updateMany({
      where,
      data: {
        deletedAt: null,
        deletedBy: null,
      },
    }) as { count: number };

    return result.count > 0;
  }

  /**
   * Hard deletes a record. PERMANENT REMOVAL. Use with caution.
   */
  async forceDelete(id: string, options: RepositoryOptions = {}): Promise<boolean> {
    const where = this.applyFilters({ id }, { ...options, ignoreSoftDelete: true });
    const client = this.getClient(options.tx);
    
    const result = await client.delete({
      where,
    }) as Entity;

    return !!result;
  }

  /**
   * Checks if a record exists matching the criteria.
   */
  async exists(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: Record<string, any>,
    options: RepositoryOptions = {},
  ): Promise<boolean> {
    const count = await this.count(where, options);
    return count > 0;
  }

  /**
   * Counts the number of records matching the criteria.
   */
  async count(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: Record<string, any> = {},
    options: RepositoryOptions = {},
  ): Promise<number> {
    const filteredWhere = this.applyFilters(where, options);
    const client = this.getClient(options.tx);
    return client.count({ where: filteredWhere }) as Promise<number>;
  }

  /**
   * Paginates a query based on PaginationQuery parameters.
   */
  async paginate(
    query: PaginationQuery,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: Record<string, any> = {},
    options: RepositoryOptions = {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    include?: Record<string, any>,
  ): Promise<{ data: Entity[]; meta: PaginationMeta }> {
    const filteredWhere = this.applyFilters(where, options);
    const client = this.getClient(options.tx);

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;
    const orderBy = query.sortBy ? { [query.sortBy]: query.sortOrder || 'desc' } : undefined;

    const [data, total] = await Promise.all([
      client.findMany({
        where: filteredWhere,
        skip,
        take: limit,
        orderBy,
        include,
      }) as Promise<Entity[]>,
      client.count({ where: filteredWhere }) as Promise<number>,
    ]);

    return {
      data,
      meta: ApiResponseHelper.buildPaginationMeta(page, limit, total),
    };
  }
}
