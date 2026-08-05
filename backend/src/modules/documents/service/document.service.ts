import { Request } from 'express';
import { Document, AuditEventType } from '@prisma/client';
import { prisma } from '@config/database';
import { storageConfig } from '@config/storage';
import { BaseService } from '@shared/base';
import { AppError, BadRequestError, ConflictError, UnauthorizedError, UnsupportedMediaTypeError } from '@shared/errors';
import { ErrorCode } from '@shared/enums';
import { PaginationMeta } from '@shared/types';
import { MESSAGES } from '@shared/constants';
import { CryptoUtils, FileValidation } from '@shared/utils';
import { S3StorageService } from '@storage/s3-storage.service';
import { AuditLogRecorder } from '@modules/audit';
import { UserRepository } from '@modules/users/repository/user.repository';
import { DocumentRepository } from '../repository/document.repository';
import { DocumentShareRepository } from '../repository/document-share.repository';
import { DocumentFolderRepository } from '../repository/document-folder.repository';
import { StorageQuotaService } from './storage-quota.service';
import { DocumentAccessScope, DocumentAccessScopeService } from './document-access-scope.service';
import { DocumentMapper } from '../mapper/document.mapper';
import { CreateDocumentDto, UpdateDocumentDto, ListDocumentsQueryDto, ShareDocumentDto } from '../dto/document.req.dto';
import { DocumentConflictDto, DocumentDownloadUrlResponseDto } from '../dto/document.res.dto';

/** Strips path separators and unsafe characters before the name becomes part of an S3 key. */
function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Document Service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Business logic for the `Document` entity. No HTTP concerns — callers
 * (controllers) pass plain values in and get domain entities back. Mirrors
 * `modules/crm/service/lead.service.ts`.
 *
 * `uploadDocument()` is the one CRUD method with real logic: it validates the
 * multipart file (`multer`-parsed, memory storage — see
 * `routes/document.routes.ts`) against the shared `UPLOAD` mime/size
 * constants, uploads the buffer to the real S3/R2 bucket via
 * `S3StorageService`, then persists the metadata row. If the S3 call throws,
 * no `Document` row is ever created — there is nothing to roll back (unlike
 * `LeadService.convertLead()`, this isn't wrapped in a DB transaction because
 * the S3 write isn't part of one).
 *
 * PRD §7.2 versioning ("never overwrite by accident") — `uploadDocument()`
 * additionally checks for a "replace candidate" (same Business + Contact +
 * Folder + Category + filename, see `DocumentRepository.findConflict()`).
 * Finding one without `dto.createVersion` throws a `ConflictError` (409)
 * carrying the current version's details rather than silently overwriting or
 * silently creating a duplicate; the caller must re-upload with
 * `createVersion=true` (or call `createVersion()`/`POST /documents/:id/version`
 * directly against a known document id) to confirm. `createVersion()` never
 * mutates the prior version's row beyond flipping `isLatestVersion` — a new
 * `Document` row is created with its own unique `storageKey`, so the old
 * object is never renamed or deleted in the bucket and remains downloadable.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class DocumentService extends BaseService {
  constructor(
    req: Request,
    private readonly documentRepository: DocumentRepository = new DocumentRepository(prisma),
    private readonly storageService: S3StorageService = new S3StorageService(),
    private readonly auditLogRecorder: AuditLogRecorder = new AuditLogRecorder(),
    private readonly accessScopeService: DocumentAccessScopeService = new DocumentAccessScopeService(),
    private readonly documentShareRepository: DocumentShareRepository = new DocumentShareRepository(prisma),
    private readonly userRepository: UserRepository = new UserRepository(prisma),
    private readonly folderRepository: DocumentFolderRepository = new DocumentFolderRepository(prisma),
    private readonly storageQuotaService: StorageQuotaService = new StorageQuotaService(),
  ) {
    super(req);
  }

  /**
   * Resolves the caller's `DocumentAccessScopeService` scope (PRD 6.2 —
   * Accountant/Auditor/Client isolation). Every read/write method below
   * routes through this single call site so the actual scoping rule lives
   * in exactly one place; see that service's header comment.
   */
  private async getAccessScope(): Promise<DocumentAccessScope> {
    if (!this.req.user) {
      throw new UnauthorizedError();
    }
    return this.accessScopeService.resolve(this.req.user);
  }

  /**
   * PRD §7.1 rule 1 — "never introduce tenant-level orphan documents". A
   * true orphan is a document anchored to *neither* a Business nor a
   * Contact; this deliberately still allows the pre-existing Contact-only
   * case (see `prisma/schema.prisma`'s `Document` header comment) since that
   * predates this PRD section and has its own dedicated integration
   * coverage. Cross-field, so it can't live in the (refine-free) Zod schema
   * — see `schemas/document.schema.ts`'s header comment.
   */
  private assertNotOrphan(businessId: string | null, contactId: string | null): void {
    if (!businessId && !contactId) {
      throw new BadRequestError('A document must be linked to at least one of businessId or contactId.');
    }
  }

  /**
   * PRD §7.1 rule 3 — a folder is always rooted at one Business+category, so
   * a document placed inside one must share that same Business+category.
   * When `businessId` is omitted it's silently filled in from the folder
   * (the common case: the caller already navigated into that folder's
   * Business), but an explicitly-provided `businessId` that disagrees with
   * the folder is a real error, not silently overridden. Returns the
   * effective `businessId` to persist.
   */
  private async resolveFolderConsistency(
    folderId: string | null | undefined,
    businessId: string | null,
    category: Document['category'],
  ): Promise<string | null> {
    if (!folderId) {
      return businessId;
    }

    const folder = await this.folderRepository.findById(folderId, { tenantId: this.tenantId });
    this.validateExists(folder, 'Folder');

    const effectiveBusinessId = businessId ?? folder.businessId;
    if (folder.businessId !== effectiveBusinessId || folder.category !== category) {
      throw new BadRequestError('folderId must belong to the same Business and category as the document.');
    }

    return effectiveBusinessId;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Create / Update / Delete
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Shared by `uploadDocument()` and `createVersion()` — presence, extension, MIME-type, and
   * content-signature rules for every file write (PRD §7.5). Reuses the same `FileValidation`
   * the `multer` `fileFilter` already ran in `routes/document.routes.ts` — this is deliberately
   * NOT trusting that middleware-layer check alone, since a future non-HTTP upload path (import,
   * queue, integration) would skip `multer` entirely but still call this service. Unlike the
   * `fileFilter`, this also has `file.buffer` available, so it additionally verifies the file's
   * magic bytes match its declared type — the fileFilter runs before the body is read, so it
   * can only check the extension/MIME headers. The size limit is deliberately NOT checked here
   * (PRD §7.4 — it varies per tenant/plan, so it's resolved and enforced by
   * `assertUploadAllowed()`/`StorageQuotaService` instead, alongside the business/tenant
   * storage-quota checks).
   */
  private validateFile(file: Express.Multer.File | undefined): asserts file is Express.Multer.File {
    if (!file) {
      throw new BadRequestError(MESSAGES.FILE_MISSING, undefined, ErrorCode.FILE_MISSING);
    }
    const result = FileValidation.validate(file.originalname, file.mimetype, file.buffer);
    if (!result.valid) {
      throw new UnsupportedMediaTypeError(result.reason);
    }
  }

  /**
   * Best-effort audit log for a rejected upload — shared by `validateFile()`'s callers (PRD §7.5
   * type/extension rejections) and `assertUploadAllowed()` (PRD §7.4 size/quota rejections) so
   * the "record an `UPLOAD_REJECTED` event, swallow-errors, same shape" logic exists in exactly
   * one place. `businessId` may be unresolved yet when a file-type rejection fires before folder
   * consistency is checked — falls back to a Tenant-scoped audit target, same as a quota
   * rejection with no businessId.
   */
  private async recordUploadRejection(error: unknown, businessId: string | null): Promise<void> {
    const tenantId = this.tenantId as string;
    if (error instanceof AppError && this.userId) {
      await this.auditLogRecorder.record({
        tenantId,
        actorId: this.userId,
        eventType: AuditEventType.UPLOAD_REJECTED,
        description: `Upload rejected: ${error.message}`,
        targetType: businessId ? 'Business' : 'Tenant',
        targetId: businessId ?? tenantId,
        ipAddress: this.req.ip ?? null,
      });
    }
  }

  /**
   * PRD §7.4 — the single enforcement point for every upload-rule check, in the mandated order:
   * file size → business quota → tenant quota. Shared by `uploadDocument()` (fresh uploads and
   * conflict-confirmed version creation) and `createVersion()` (explicit `/:id/version` replace) —
   * each calls this exactly once before touching S3, so `createVersionFromExisting()` itself never
   * re-checks. A rejection is audit-logged via `recordUploadRejection()` before being rethrown.
   */
  private async assertUploadAllowed(businessId: string | null, fileSize: number): Promise<void> {
    const tenantId = this.tenantId as string;

    try {
      await this.storageQuotaService.assertFileSizeAllowed(tenantId, fileSize);
      if (businessId) {
        await this.storageQuotaService.assertBusinessQuota(tenantId, businessId, fileSize);
      }
      await this.storageQuotaService.assertTenantQuota(tenantId, fileSize);
    } catch (error) {
      await this.recordUploadRejection(error, businessId);
      throw error;
    }
  }

  async uploadDocument(dto: CreateDocumentDto, file: Express.Multer.File | undefined): Promise<Document> {
    const userId = this.userId;
    if (!userId) {
      throw new UnauthorizedError();
    }

    try {
      this.validateFile(file);
    } catch (error) {
      await this.recordUploadRejection(error, dto.businessId ?? null);
      throw error;
    }

    const businessId = await this.resolveFolderConsistency(dto.folderId, dto.businessId ?? null, dto.category);
    this.assertNotOrphan(businessId, dto.contactId ?? null);
    const contactId = dto.contactId ?? null;
    const folderId = dto.folderId ?? null;

    const scope = await this.getAccessScope();
    DocumentAccessScopeService.assertAllowed({ id: '', businessId, contactId, category: dto.category }, scope);

    // PRD §7.4 — file size → business quota → tenant quota, in that order. Runs before the
    // conflict check/S3 write so a rejected upload never touches the bucket.
    await this.assertUploadAllowed(businessId, file.size);

    // PRD §7.2 rule 6 — "replace candidate" detection. Runs before the S3 write so a
    // detected conflict never touches the bucket.
    const conflict = await this.documentRepository.findConflict(
      { businessId, contactId, folderId, category: dto.category, fileName: file.originalname },
      { tenantId: this.tenantId },
    );

    if (conflict) {
      if (!dto.createVersion) {
        throw new ConflictError(
          `A document named "${file.originalname}" already exists here (current version v${conflict.version}). Re-upload with createVersion=true to confirm replacement.`,
          ErrorCode.DUPLICATE_RECORD,
          {
            message: 'Replacement candidate detected',
            currentVersion: DocumentMapper.toResponseDto(conflict),
            nextVersion: conflict.version + 1,
          } satisfies DocumentConflictDto,
        );
      }

      this.logger.info({ documentId: conflict.id, fileName: file.originalname }, 'Upload confirmed as new version');
      return this.createVersionFromExisting(conflict, file, userId);
    }

    const storageKey = `${this.tenantId}/${CryptoUtils.generateRandomToken(16)}-${sanitizeFileName(file.originalname)}`;

    this.logger.info({ category: dto.category, fileName: file.originalname, sizeBytes: file.size }, 'Uploading document');

    // Real object write — no S3 row exists yet, so a failure here throws
    // before any Document metadata is persisted.
    await this.storageService.upload(storageKey, file.buffer, file.mimetype);

    const document = await this.documentRepository.create(
      {
        businessId,
        contactId,
        folderId,
        category: dto.category,
        fileName: file.originalname,
        storageKey,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        version: 1,
        isLatestVersion: true,
        uploadedById: userId,
      },
      { tenantId: this.tenantId },
    );

    await this.auditLogRecorder.record({
      tenantId: this.tenantId as string,
      actorId: userId,
      eventType: AuditEventType.UPLOAD,
      description: `Uploaded document "${document.fileName}"`,
      targetType: 'Document',
      targetId: document.id,
      ipAddress: this.req.ip ?? null,
    });

    return document;
  }

  /**
   * PRD §7.2 rules 7-8 — explicit replace flow: `POST /documents/:id/version`.
   * Unlike `uploadDocument()`'s filename-match conflict detection, this always
   * versions `existingId` directly regardless of the new file's name (the
   * caller already knows exactly which document they're replacing).
   */
  async createVersion(existingId: string, file: Express.Multer.File | undefined): Promise<Document> {
    const userId = this.userId;
    if (!userId) {
      throw new UnauthorizedError();
    }

    try {
      this.validateFile(file);
    } catch (error) {
      await this.recordUploadRejection(error, null);
      throw error;
    }

    const existing = await this.documentRepository.findById(existingId, { tenantId: this.tenantId });
    this.validateExists(existing, 'Document');

    const scope = await this.getAccessScope();
    DocumentAccessScopeService.assertAllowed(existing, scope);

    await this.assertUploadAllowed(existing.businessId, file.size);

    return this.createVersionFromExisting(existing, file, userId);
  }

  /**
   * Shared version-creation core for both entry points above. Uploads the new
   * object first (mirrors `uploadDocument()`'s "no row without a successful S3
   * write" rule), then atomically flips the prior latest version's
   * `isLatestVersion` flag and inserts the new row in one DB transaction so a
   * reader can never observe two "latest" versions at once.
   */
  private async createVersionFromExisting(existing: Document, file: Express.Multer.File, userId: string): Promise<Document> {
    const storageKey = `${this.tenantId}/${CryptoUtils.generateRandomToken(16)}-${sanitizeFileName(file.originalname)}`;

    this.logger.info({ documentId: existing.id, fileName: file.originalname, sizeBytes: file.size }, 'Uploading document version');

    await this.storageService.upload(storageKey, file.buffer, file.mimetype);

    const rootDocumentId = existing.rootDocumentId ?? existing.id;
    const nextVersion = existing.version + 1;

    const newVersion = await this.transaction(async (tx) => {
      await this.documentRepository.update(existing.id, { isLatestVersion: false }, { tenantId: this.tenantId, tx });
      return this.documentRepository.create(
        {
          businessId: existing.businessId,
          contactId: existing.contactId,
          folderId: existing.folderId,
          category: existing.category,
          fileName: file.originalname,
          storageKey,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          version: nextVersion,
          isLatestVersion: true,
          rootDocumentId,
          previousVersionId: existing.id,
          uploadedById: userId,
        },
        { tenantId: this.tenantId, tx },
      );
    });

    await this.auditLogRecorder.record({
      tenantId: this.tenantId as string,
      actorId: userId,
      eventType: AuditEventType.VERSION_CREATE,
      description: `Created version ${nextVersion} of document "${newVersion.fileName}" (replacing v${existing.version})`,
      targetType: 'Document',
      targetId: newVersion.id,
      ipAddress: this.req.ip ?? null,
    });

    return newVersion;
  }

  /**
   * PRD §7.2 rule 8 — `GET /documents/:id/versions`. `id` may be any version in
   * the chain (not necessarily the latest or the root); the full chain is
   * always returned, oldest first. Access is checked against the requested
   * document itself — every version in a chain shares the same
   * Business/Contact/category (see `createVersionFromExisting()`), so this is
   * equivalent to checking any other version.
   */
  async getVersionHistory(id: string): Promise<Document[]> {
    const document = await this.getDocumentById(id);
    return this.documentRepository.findVersionChain(document, { tenantId: this.tenantId });
  }

  async updateDocument(id: string, dto: UpdateDocumentDto): Promise<Document> {
    const existing = await this.documentRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'Document');

    const scope = await this.getAccessScope();
    DocumentAccessScopeService.assertAllowed(existing, scope);

    const effectiveCategory = dto.category ?? existing.category;
    const effectiveContactId = dto.contactId !== undefined ? dto.contactId : existing.contactId;
    const effectiveFolderId = dto.folderId !== undefined ? dto.folderId : existing.folderId;
    const requestedBusinessId = dto.businessId !== undefined ? dto.businessId : existing.businessId;
    const effectiveBusinessId = await this.resolveFolderConsistency(effectiveFolderId, requestedBusinessId, effectiveCategory);
    this.assertNotOrphan(effectiveBusinessId, effectiveContactId);

    // A caller may only move a document to a Business/category they themselves can already reach —
    // prevents a scoped user from re-tagging a document out of/into their own restricted view.
    DocumentAccessScopeService.assertAllowed(
      { id: existing.id, businessId: effectiveBusinessId, contactId: effectiveContactId, category: effectiveCategory },
      scope,
    );

    this.logger.info({ documentId: id }, 'Updating document');

    return this.documentRepository.update(
      id,
      { ...dto, businessId: effectiveBusinessId },
      { tenantId: this.tenantId },
    );
  }

  async deleteDocument(id: string): Promise<void> {
    const existing = await this.documentRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'Document');

    const scope = await this.getAccessScope();
    DocumentAccessScopeService.assertAllowed(existing, scope);

    this.logger.info({ documentId: id }, 'Deleting document');

    await this.documentRepository.delete(id, { tenantId: this.tenantId, userId: this.userId });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Reads
  // ────────────────────────────────────────────────────────────────────────────

  async getDocumentById(id: string): Promise<Document> {
    const document = await this.documentRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(document, 'Document');

    const scope = await this.getAccessScope();
    DocumentAccessScopeService.assertAllowed(document, scope);

    return document;
  }

  async listDocuments(query: ListDocumentsQueryDto): Promise<{ data: Document[]; meta: PaginationMeta }> {
    const scope = await this.getAccessScope();

    return this.documentRepository.search(
      {
        category: query.category,
        businessId: query.businessId,
        folderId: query.folderId,
        search: query.search,
        uploadedFrom: query.uploadedFrom,
        uploadedTo: query.uploadedTo,
      },
      {
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
      { tenantId: this.tenantId },
      DocumentAccessScopeService.toWhereInput(scope),
    );
  }

  /**
   * Grants another user in the tenant read access to this document via the
   * `ResourceAccessPolicy` table (see `DocumentShareRepository`). Reuses
   * `getDocumentById()` rather than re-querying/re-checking access itself —
   * a caller can only share a document they can already see.
   */
  async shareDocument(id: string, dto: ShareDocumentDto): Promise<Document> {
    const document = await this.getDocumentById(id);

    if (!this.userId || !this.tenantId) {
      throw new UnauthorizedError();
    }

    if (dto.userId === this.userId) {
      throw new BadRequestError('Cannot share a document with yourself.');
    }

    const targetExists = await this.userRepository.exists({ id: dto.userId }, { tenantId: this.tenantId });
    if (!targetExists) {
      throw new BadRequestError('Target user not found in this tenant.');
    }

    await this.documentShareRepository.upsertShare({
      tenantId: this.tenantId,
      documentId: document.id,
      sharedWithUserId: dto.userId,
      grantedById: this.userId,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });

    this.logger.info({ documentId: id, sharedWithUserId: dto.userId }, 'Shared document');

    await this.auditLogRecorder.record({
      tenantId: this.tenantId,
      actorId: this.userId,
      eventType: AuditEventType.SHARE,
      description: `Shared document "${document.fileName}" with user ${dto.userId}`,
      targetType: 'Document',
      targetId: document.id,
      ipAddress: this.req.ip ?? null,
    });

    return document;
  }

  /** Presigned, time-limited GET URL — never returns the bucket's raw credentials or a permanent link. */
  async getDownloadUrl(id: string): Promise<DocumentDownloadUrlResponseDto> {
    const document = await this.getDocumentById(id);
    const url = await this.storageService.getDownloadUrl(document.storageKey, document.fileName);

    if (this.userId) {
      await this.auditLogRecorder.record({
        tenantId: this.tenantId as string,
        actorId: this.userId,
        eventType: AuditEventType.DOWNLOAD,
        description: `Downloaded document "${document.fileName}"`,
        targetType: 'Document',
        targetId: document.id,
        ipAddress: this.req.ip ?? null,
      });
    }

    return { url, expiresInSeconds: storageConfig.presignedUrlExpirySeconds };
  }
}
