import { PrismaClient, Prisma, TaskTemplate, TaskType } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';
import { PaginationQuery, PaginationMeta } from '@shared/types';

/** Domain-shaped search criteria for `TaskTemplateRepository.search()`. */
export interface TaskTemplateSearchFilters {
  type?: TaskType;
  isActive?: boolean;
  /** Matches against `name` (case-insensitive). */
  search?: string;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Task Template Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Data access for the `TaskTemplate` entity only. Inherits tenant scoping,
 * soft delete, and standard CRUD/pagination from `BaseRepository`. Mirrors
 * `modules/tasks/repository/task.repository.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class TaskTemplateRepository extends BaseRepository<Prisma.TaskTemplateDelegate, TaskTemplate> {
  constructor(prisma: PrismaClient) {
    super(prisma.taskTemplate, prisma);
  }

  /** Finds all active templates of a given type, newest first. */
  async findActiveByType(type: TaskType, options: RepositoryOptions = {}): Promise<TaskTemplate[]> {
    return this.findMany({ type, isActive: true }, options, undefined, { createdAt: 'desc' });
  }

  /**
   * Paginated search combining the standard list filters. Builds the Prisma
   * `where` clause internally so callers only ever deal with
   * `TaskTemplateSearchFilters`.
   */
  async search(
    filters: TaskTemplateSearchFilters,
    pagination: PaginationQuery,
    options: RepositoryOptions = {},
  ): Promise<{ data: TaskTemplate[]; meta: PaginationMeta }> {
    const where: Prisma.TaskTemplateWhereInput = {};

    if (filters.type) where.type = filters.type;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.search) where.name = { contains: filters.search, mode: 'insensitive' };

    return this.paginate(pagination, where, options);
  }
}
