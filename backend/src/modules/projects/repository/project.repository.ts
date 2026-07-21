import { PrismaClient, Prisma, Project, ProjectStatus } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';
import { PaginationQuery, PaginationMeta } from '@shared/types';

/**
 * Domain-shaped search criteria for `ProjectRepository.search()`.
 * Deliberately Prisma-agnostic — the repository is responsible for translating
 * this into a `Prisma.ProjectWhereInput`, so callers (the service layer) never
 * need to import Prisma query-builder types.
 */
export interface ProjectSearchFilters {
  status?: ProjectStatus;
  clientId?: string;
  managerId?: string;
  dueBefore?: Date;
  dueAfter?: Date;
  /** Matches against `name` or `code` (case-insensitive). */
  search?: string;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Project Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Data access for the `Project` (engagement) entity. Inherits tenant scoping,
 * soft delete, and standard CRUD/pagination from `BaseRepository`; adds only
 * the finder methods specific to projects.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class ProjectRepository extends BaseRepository<Prisma.ProjectDelegate, Project> {
  constructor(prisma: PrismaClient) {
    super(prisma.project, prisma);
  }

  /**
   * Finds a project by its tenant-unique engagement code.
   */
  async findByCode(code: string, options: RepositoryOptions = {}): Promise<Project | null> {
    return this.findFirst({ code }, options);
  }

  /**
   * Finds all projects belonging to a given client, newest first.
   */
  async findByClient(clientId: string, options: RepositoryOptions = {}): Promise<Project[]> {
    return this.findMany({ clientId }, options, undefined, { createdAt: 'desc' });
  }

  /**
   * Finds all projects in one of the given statuses.
   */
  async findByStatus(
    statuses: ProjectStatus[],
    options: RepositoryOptions = {},
  ): Promise<Project[]> {
    return this.findMany({ status: { in: statuses } }, options);
  }

  /**
   * Finds active projects whose due date has passed.
   */
  async findOverdue(options: RepositoryOptions = {}): Promise<Project[]> {
    return this.findMany(
      {
        dueDate: { lt: new Date() },
        status: {
          notIn: [ProjectStatus.COMPLETED, ProjectStatus.ARCHIVED, ProjectStatus.CANCELLED],
        },
      },
      options,
      undefined,
      { dueDate: 'asc' },
    );
  }

  /**
   * Paginated search combining the standard list filters. Builds the Prisma
   * `where` clause internally so the service layer only ever deals with
   * `ProjectSearchFilters`.
   */
  async search(
    filters: ProjectSearchFilters,
    pagination: PaginationQuery,
    options: RepositoryOptions = {},
  ): Promise<{ data: Project[]; meta: PaginationMeta }> {
    const where: Prisma.ProjectWhereInput = {};

    if (filters.status) where.status = filters.status;
    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.managerId) where.managerId = filters.managerId;

    if (filters.dueBefore || filters.dueAfter) {
      where.dueDate = {
        ...(filters.dueBefore && { lte: filters.dueBefore }),
        ...(filters.dueAfter && { gte: filters.dueAfter }),
      };
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { code: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.paginate(pagination, where, options);
  }
}
