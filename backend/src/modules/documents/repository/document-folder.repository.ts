import { PrismaClient, Prisma, DocumentFolder, DocumentCategory } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';

/** Domain-shaped filters for `DocumentFolderRepository.findByBusiness()`. */
export interface DocumentFolderListFilters {
  category?: DocumentCategory;
  /**
   * `undefined` → every folder for the Business/category (flat list, tree
   * built client-side). `null` → only root-level folders. A string → only
   * that folder's direct children.
   */
  parentFolderId?: string | null;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Document Folder Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Data access for the `DocumentFolder` entity (PRD §7.1 rule 3 — adjacency-
 * list hierarchy). Inherits tenant scoping, soft delete, and standard CRUD
 * from `BaseRepository`; adds only the finders specific to folders. Mirrors
 * `modules/documents/repository/document.repository.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class DocumentFolderRepository extends BaseRepository<Prisma.DocumentFolderDelegate, DocumentFolder> {
  constructor(prisma: PrismaClient) {
    super(prisma.documentFolder, prisma);
  }

  /**
   * Every folder for one Business, optionally narrowed to one category and/or
   * one direct parent. `scopeWhere` is ANDed on, mirroring
   * `DocumentRepository.search()`'s identical `scopeWhere` parameter — see
   * that file's header comment.
   */
  async findByBusiness(
    businessId: string,
    filters: DocumentFolderListFilters,
    options: RepositoryOptions = {},
    scopeWhere?: Prisma.DocumentFolderWhereInput,
  ): Promise<DocumentFolder[]> {
    const where: Prisma.DocumentFolderWhereInput = { businessId };

    if (filters.category) where.category = filters.category;
    if (filters.parentFolderId !== undefined) where.parentFolderId = filters.parentFolderId;

    const combinedWhere = scopeWhere && Object.keys(scopeWhere).length > 0 ? { AND: [where, scopeWhere] } : where;

    return this.findMany(combinedWhere, options, undefined, { name: 'asc' });
  }

  /** True if any non-deleted child folder still references this folder as its parent. */
  async hasChildFolders(folderId: string, options: RepositoryOptions = {}): Promise<boolean> {
    return this.exists({ parentFolderId: folderId }, options);
  }

  /**
   * True if any non-deleted `Document` still references this folder — checked
   * against the `documents` table directly (not `BaseRepository`, which only
   * ever queries its own delegate).
   */
  async hasDocuments(folderId: string, options: RepositoryOptions = {}): Promise<boolean> {
    const where: Prisma.DocumentWhereInput = { folderId };
    if (!options.ignoreSoftDelete) where.deletedAt = null;
    if (!options.ignoreTenant) {
      if (!options.tenantId) {
        throw new Error('Security Violation: tenantId is required for this query. If this is a system query, pass ignoreTenant: true.');
      }
      where.tenantId = options.tenantId;
    }

    const count = await this.prisma.document.count({ where });
    return count > 0;
  }
}
