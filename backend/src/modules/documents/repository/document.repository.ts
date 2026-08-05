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
  folderId?: string;
  /** Matches against `fileName` (case-insensitive). */
  search?: string;
  /** Bounds on `createdAt` (the upload date). */
  uploadedFrom?: Date;
  uploadedTo?: Date;
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

  /**
   * `scopeWhere` is ANDed onto `filters`' own `where` clause — it carries the
   * caller's `DocumentAccessScopeService`-resolved restriction (assigned
   * Businesses / AUDIT-only category / own Contact), kept separate from
   * `filters` since it's derived from the requester's identity, not query
   * parameters. Optional and additive, so existing callers are unaffected.
   */
  async search(
    filters: DocumentSearchFilters,
    pagination: PaginationQuery,
    options: RepositoryOptions = {},
    scopeWhere?: Prisma.DocumentWhereInput,
  ): Promise<{ data: Document[]; meta: PaginationMeta }> {
    const where: Prisma.DocumentWhereInput = {};

    if (filters.category) where.category = filters.category;
    if (filters.businessId) where.businessId = filters.businessId;
    if (filters.folderId) where.folderId = filters.folderId;
    if (filters.search) where.fileName = { contains: filters.search, mode: 'insensitive' };
    if (filters.uploadedFrom || filters.uploadedTo) {
      where.createdAt = { gte: filters.uploadedFrom, lte: filters.uploadedTo };
    }

    const combinedWhere = scopeWhere && Object.keys(scopeWhere).length > 0 ? { AND: [where, scopeWhere] } : where;

    return this.paginate(pagination, combinedWhere, options);
  }

  /**
   * PRD §7.2 rule 6 — "replace candidate" detection. A conflict is the current
   * latest version of a document anchored to the exact same
   * Business + Contact + Folder + Category + filename. Deliberately an exact
   * (case-sensitive) `fileName` match, not the fuzzy `search` filter `search()`
   * uses — this drives an automatic 409, so it must never fire on a merely
   * similar name.
   */
  async findConflict(
    criteria: {
      businessId: string | null;
      contactId: string | null;
      folderId: string | null;
      category: DocumentCategory;
      fileName: string;
    },
    options: RepositoryOptions = {},
  ): Promise<Document | null> {
    return this.findFirst(
      {
        businessId: criteria.businessId,
        contactId: criteria.contactId,
        folderId: criteria.folderId,
        category: criteria.category,
        fileName: criteria.fileName,
        isLatestVersion: true,
      },
      options,
    );
  }

  /**
   * Every version sharing `document`'s chain — the root (v1) row plus every row
   * whose `rootDocumentId` points at it — oldest first. `document` itself may be
   * the root or any later version; the root id is resolved the same way
   * `DocumentService` does (`rootDocumentId ?? id`).
   */
  async findVersionChain(document: Pick<Document, 'id' | 'rootDocumentId'>, options: RepositoryOptions = {}): Promise<Document[]> {
    const rootId = document.rootDocumentId ?? document.id;
    return this.findMany({ OR: [{ id: rootId }, { rootDocumentId: rootId }] }, options, undefined, { version: 'asc' });
  }
}
