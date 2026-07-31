import { Request } from 'express';
import { Document, AuditEventType } from '@prisma/client';
import { prisma } from '@config/database';
import { storageConfig } from '@config/storage';
import { BaseService } from '@shared/base';
import { BadRequestError, UnauthorizedError } from '@shared/errors';
import { PaginationMeta } from '@shared/types';
import { UPLOAD } from '@shared/constants';
import { CryptoUtils } from '@shared/utils';
import { S3StorageService } from '@storage/s3-storage.service';
import { AuditLogRecorder } from '@modules/audit';
import { DocumentRepository } from '../repository/document.repository';
import { CreateDocumentDto, UpdateDocumentDto, ListDocumentsQueryDto } from '../dto/document.req.dto';
import { DocumentDownloadUrlResponseDto } from '../dto/document.res.dto';

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
 * `uploadDocument()` is the one method that isn't pure CRUD: it validates the
 * multipart file (`multer`-parsed, memory storage — see
 * `routes/document.routes.ts`) against the shared `UPLOAD` mime/size
 * constants, uploads the buffer to the real S3/R2 bucket via
 * `S3StorageService`, then persists the metadata row. If the S3 call throws,
 * no `Document` row is ever created — there is nothing to roll back (unlike
 * `LeadService.convertLead()`, this isn't wrapped in a DB transaction because
 * the S3 write isn't part of one).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class DocumentService extends BaseService {
  constructor(
    req: Request,
    private readonly documentRepository: DocumentRepository = new DocumentRepository(prisma),
    private readonly storageService: S3StorageService = new S3StorageService(),
    private readonly auditLogRecorder: AuditLogRecorder = new AuditLogRecorder(),
  ) {
    super(req);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Create / Update / Delete
  // ────────────────────────────────────────────────────────────────────────────

  async uploadDocument(dto: CreateDocumentDto, file: Express.Multer.File | undefined): Promise<Document> {
    const userId = this.userId;
    if (!userId) {
      throw new UnauthorizedError();
    }

    if (!file) {
      throw new BadRequestError('A file is required.');
    }
    if (!(UPLOAD.ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(file.mimetype)) {
      throw new BadRequestError(`Unsupported file type: ${file.mimetype}`);
    }
    if (file.size > UPLOAD.MAX_FILE_SIZE_BYTES) {
      throw new BadRequestError('File exceeds the maximum upload size.');
    }

    const storageKey = `${this.tenantId}/${CryptoUtils.generateRandomToken(16)}-${sanitizeFileName(file.originalname)}`;

    this.logger.info({ category: dto.category, fileName: file.originalname, sizeBytes: file.size }, 'Uploading document');

    // Real object write — no S3 row exists yet, so a failure here throws
    // before any Document metadata is persisted.
    await this.storageService.upload(storageKey, file.buffer, file.mimetype);

    const document = await this.documentRepository.create(
      {
        businessId: dto.businessId ?? null,
        contactId: dto.contactId ?? null,
        category: dto.category,
        fileName: file.originalname,
        storageKey,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        version: 1,
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

  async updateDocument(id: string, dto: UpdateDocumentDto): Promise<Document> {
    const existing = await this.documentRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'Document');

    this.logger.info({ documentId: id }, 'Updating document');

    return this.documentRepository.update(id, dto, { tenantId: this.tenantId });
  }

  async deleteDocument(id: string): Promise<void> {
    const existing = await this.documentRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'Document');

    this.logger.info({ documentId: id }, 'Deleting document');

    await this.documentRepository.delete(id, { tenantId: this.tenantId, userId: this.userId });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Reads
  // ────────────────────────────────────────────────────────────────────────────

  async getDocumentById(id: string): Promise<Document> {
    const document = await this.documentRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(document, 'Document');
    return document;
  }

  async listDocuments(query: ListDocumentsQueryDto): Promise<{ data: Document[]; meta: PaginationMeta }> {
    return this.documentRepository.search(
      { category: query.category, businessId: query.businessId, search: query.search },
      {
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
      { tenantId: this.tenantId },
    );
  }

  /** Presigned, time-limited GET URL — never returns the bucket's raw credentials or a permanent link. */
  async getDownloadUrl(id: string): Promise<DocumentDownloadUrlResponseDto> {
    const document = await this.getDocumentById(id);
    const url = await this.storageService.getDownloadUrl(document.storageKey);

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
