import { Request } from 'express';
import { DocumentFolder, AuditEventType } from '@prisma/client';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { BadRequestError, ConflictError, UnauthorizedError } from '@shared/errors';
import { AuditLogRecorder } from '@modules/audit';
import { BusinessRepository } from '@modules/business/repository/business.repository';
import { DocumentFolderRepository } from '../repository/document-folder.repository';
import { DocumentAccessScope, DocumentAccessScopeService } from './document-access-scope.service';
import { CreateFolderDto, UpdateFolderDto, ListFoldersQueryDto } from '../dto/document-folder.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Document Folder Service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Business logic for `DocumentFolder` (PRD §7.1 rule 3 — Business → category
 * → Folder → Subfolder → Documents, adjacency-list). Mirrors
 * `DocumentService`'s shape and, critically, its authorization pipeline:
 * every method resolves the caller's `DocumentAccessScopeService` scope and
 * routes it through `assertFolderAllowed`/`toFolderWhereInput` — the exact
 * same scope object `DocumentService` resolves, just fed through the
 * folder-specific static helpers (folders have no `contactId`/share concept
 * — see that service's header comment). No second authorization system.
 *
 * Cross-field rules the (deliberately refine-free — see
 * `schemas/document-folder.schema.ts`) Zod schemas can't express:
 *   - a sub-folder's `parentFolder` must belong to the same Business+category
 *   - sibling folder names (same parent, same Business+category) are unique,
 *     case-insensitively
 *   - a folder cannot be deleted while it still has child folders or documents
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class DocumentFolderService extends BaseService {
  constructor(
    req: Request,
    private readonly folderRepository: DocumentFolderRepository = new DocumentFolderRepository(prisma),
    private readonly businessRepository: BusinessRepository = new BusinessRepository(prisma),
    private readonly accessScopeService: DocumentAccessScopeService = new DocumentAccessScopeService(),
    private readonly auditLogRecorder: AuditLogRecorder = new AuditLogRecorder(),
  ) {
    super(req);
  }

  private async recordAudit(eventType: AuditEventType, description: string, targetId: string): Promise<void> {
    if (!this.userId || !this.tenantId) return;
    await this.auditLogRecorder.record({
      tenantId: this.tenantId,
      actorId: this.userId,
      eventType,
      description,
      targetType: 'DocumentFolder',
      targetId,
      ipAddress: this.req.ip ?? null,
      userAgent: (this.req.headers?.['user-agent'] as string | undefined) ?? null,
    });
  }

  private async getAccessScope(): Promise<DocumentAccessScope> {
    if (!this.req.user) {
      throw new UnauthorizedError();
    }
    return this.accessScopeService.resolve(this.req.user);
  }

  private async assertBusinessExists(businessId: string): Promise<void> {
    const business = await this.businessRepository.findById(businessId, { tenantId: this.tenantId });
    this.validateExists(business, 'Business');
  }

  /** Case-insensitive duplicate-name guard among siblings sharing the same parent. */
  private async assertNoSiblingNameCollision(
    businessId: string,
    parentFolderId: string | null,
    name: string,
    excludeFolderId?: string,
  ): Promise<void> {
    const siblings = await this.folderRepository.findByBusiness(businessId, { parentFolderId: parentFolderId ?? undefined }, {
      tenantId: this.tenantId,
    });
    // `findByBusiness` treats an `undefined` parentFolderId filter as "no filter" (see its own
    // JSDoc), so a root-level check (`parentFolderId === null`) must be re-applied here.
    const scoped = siblings.filter((s) => s.parentFolderId === parentFolderId);
    const collision = scoped.some(
      (s) => s.id !== excludeFolderId && s.name.toLowerCase() === name.toLowerCase(),
    );
    if (collision) {
      throw new ConflictError('A folder with this name already exists at this level.');
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Create / Update / Delete
  // ────────────────────────────────────────────────────────────────────────────

  async createFolder(businessId: string, dto: CreateFolderDto): Promise<DocumentFolder> {
    const userId = this.userId;
    if (!userId) {
      throw new UnauthorizedError();
    }

    await this.assertBusinessExists(businessId);

    const scope = await this.getAccessScope();
    DocumentAccessScopeService.assertFolderAllowed({ businessId, category: dto.category }, scope);

    let parentFolderId: string | null = null;
    if (dto.parentFolderId) {
      const parent = await this.folderRepository.findById(dto.parentFolderId, { tenantId: this.tenantId });
      this.validateExists(parent, 'Parent folder');
      if (parent.businessId !== businessId || parent.category !== dto.category) {
        throw new BadRequestError('The parent folder must belong to the same Business and category.');
      }
      parentFolderId = parent.id;
    }

    await this.assertNoSiblingNameCollision(businessId, parentFolderId, dto.name);

    this.logger.info({ businessId, category: dto.category, parentFolderId }, 'Creating document folder');

    const folder = await this.folderRepository.create(
      {
        businessId,
        category: dto.category,
        parentFolderId,
        name: dto.name,
        createdById: userId,
      },
      { tenantId: this.tenantId },
    );

    await this.recordAudit(AuditEventType.FOLDER_CREATED, `Created folder "${folder.name}"`, folder.id);

    return folder;
  }

  async renameFolder(id: string, dto: UpdateFolderDto): Promise<DocumentFolder> {
    const existing = await this.folderRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'Folder');

    const scope = await this.getAccessScope();
    DocumentAccessScopeService.assertFolderAllowed(existing, scope);

    await this.assertNoSiblingNameCollision(existing.businessId, existing.parentFolderId, dto.name, existing.id);

    this.logger.info({ folderId: id }, 'Renaming document folder');

    const updated = await this.folderRepository.update(id, { name: dto.name }, { tenantId: this.tenantId });

    await this.recordAudit(AuditEventType.FOLDER_RENAMED, `Renamed folder "${existing.name}" to "${updated.name}"`, updated.id);

    return updated;
  }

  async deleteFolder(id: string): Promise<void> {
    const existing = await this.folderRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'Folder');

    const scope = await this.getAccessScope();
    DocumentAccessScopeService.assertFolderAllowed(existing, scope);

    const [hasChildFolders, hasDocuments] = await Promise.all([
      this.folderRepository.hasChildFolders(id, { tenantId: this.tenantId }),
      this.folderRepository.hasDocuments(id, { tenantId: this.tenantId }),
    ]);
    if (hasChildFolders || hasDocuments) {
      throw new ConflictError('This folder is not empty. Remove its sub-folders and documents before deleting it.');
    }

    this.logger.info({ folderId: id }, 'Deleting document folder');

    await this.folderRepository.delete(id, { tenantId: this.tenantId, userId: this.userId });

    await this.recordAudit(AuditEventType.FOLDER_DELETED, `Deleted folder "${existing.name}"`, existing.id);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Reads
  // ────────────────────────────────────────────────────────────────────────────

  async listFolders(businessId: string, query: ListFoldersQueryDto): Promise<DocumentFolder[]> {
    await this.assertBusinessExists(businessId);

    const scope = await this.getAccessScope();

    return this.folderRepository.findByBusiness(
      businessId,
      { category: query.category, parentFolderId: query.parentFolderId },
      { tenantId: this.tenantId },
      DocumentAccessScopeService.toFolderWhereInput(scope),
    );
  }

  async getFolderById(id: string): Promise<DocumentFolder> {
    const folder = await this.folderRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(folder, 'Folder');

    const scope = await this.getAccessScope();
    DocumentAccessScopeService.assertFolderAllowed(folder, scope);

    return folder;
  }
}
