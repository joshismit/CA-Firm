import { PrismaClient, Prisma, DocumentRequest, DocumentCategory, DocumentRequestStatus } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';
import { PaginationQuery, PaginationMeta } from '@shared/types';

export interface DocumentRequestSearchFilters {
  businessId?: string;
  category?: DocumentCategory;
  status?: DocumentRequestStatus;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Document Request Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Data access for `DocumentRequest` — PRD §11.4's "please provide document
 * X" ask, the prerequisite `DocumentReminderService` needs to have anything
 * to remind about (see that model's schema.prisma comment). Inherits tenant
 * scoping, soft delete, and standard CRUD/pagination from `BaseRepository`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class DocumentRequestRepository extends BaseRepository<Prisma.DocumentRequestDelegate, DocumentRequest> {
  constructor(prisma: PrismaClient) {
    super(prisma.documentRequest, prisma);
  }

  async search(
    filters: DocumentRequestSearchFilters,
    pagination: PaginationQuery,
    options: RepositoryOptions = {},
  ): Promise<{ data: DocumentRequest[]; meta: PaginationMeta }> {
    const where: Prisma.DocumentRequestWhereInput = {};

    if (filters.businessId) where.businessId = filters.businessId;
    if (filters.category) where.category = filters.category;
    if (filters.status) where.status = filters.status;

    return this.paginate(pagination, where, options);
  }

  /**
   * PRD §11.12 — candidates for `DocumentReminderService`'s scan. Only `PENDING` requests with
   * a due date are reminder candidates — a request with no `dueDate` has nothing to be
   * "tomorrow"/"7 days"/"30 days"/"overdue" relative to, so it's simply never scanned (it still
   * exists and can be fulfilled/cancelled normally, just never reminded about).
   */
  async findReminderCandidates(dueDateRange: { gte?: Date; lt?: Date }, options: RepositoryOptions = {}): Promise<DocumentRequest[]> {
    return this.findMany(
      {
        dueDate: dueDateRange,
        status: DocumentRequestStatus.PENDING,
      },
      options,
    );
  }
}
