import { PrismaClient, Prisma, Document, DocumentCategory } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';
import { PaginationQuery, PaginationMeta } from '@shared/types';

/**
 * Domain-shaped search criteria for `DocumentRepository.search()`. Mirrors
 * `modules/crm/repository/lead.repository.ts`.
 */
export interface DocumentSearchFilters {
  category?: DocumentCategory;
  businessId?: string;
  /** Matches against `fileName` (case-insensitive). */
  search?: string;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Document Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Data access for the `Document` entity. Inherits tenant scoping, soft
 * delete, and standard CRUD/pagination from `BaseRepository`; adds only the
 * search method specific to documents.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class DocumentRepository extends BaseRepository<Prisma.DocumentDelegate, Document> {
  constructor(prisma: PrismaClient) {
    super(prisma.document, prisma);
  }

  async search(
    filters: DocumentSearchFilters,
    pagination: PaginationQuery,
    options: RepositoryOptions = {},
  ): Promise<{ data: Document[]; meta: PaginationMeta }> {
    const where: Prisma.DocumentWhereInput = {};

    if (filters.category) where.category = filters.category;
    if (filters.businessId) where.businessId = filters.businessId;
    if (filters.search) where.fileName = { contains: filters.search, mode: 'insensitive' };

    return this.paginate(pagination, where, options);
  }
}
