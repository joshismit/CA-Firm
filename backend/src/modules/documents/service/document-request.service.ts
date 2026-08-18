import { Request } from 'express';
import { DocumentRequest, DocumentRequestStatus } from '@prisma/client';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { ConflictError } from '@shared/errors';
import { PaginationMeta } from '@shared/types';
import { BusinessRepository } from '@modules/business/repository/business.repository';
import { DocumentRequestRepository } from '../repository/document-request.repository';
import { DocumentRepository } from '../repository/document.repository';
import {
  CreateDocumentRequestDto,
  UpdateDocumentRequestDto,
  FulfillDocumentRequestDto,
  ListDocumentRequestsQueryDto,
} from '../dto/document-request.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Document Request Service (PRD §11.4/§11.12)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Minimal by design — the PRD-required "document follow-up reminder" needs
 * this to exist as data, not as a full document-collection workflow. Create,
 * list/get, update (description/due date only, while still `PENDING`),
 * fulfil (link the `Document` that satisfied it), cancel. No attachments UI
 * of its own beyond `fulfilledDocumentId` — the actual upload still goes
 * through the existing `DocumentService`/`POST /documents` flow; this only
 * records which upload closed out which request.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class DocumentRequestService extends BaseService {
  constructor(
    req: Request,
    private readonly repository: DocumentRequestRepository = new DocumentRequestRepository(prisma),
    private readonly businessRepository: BusinessRepository = new BusinessRepository(prisma),
    private readonly documentRepository: DocumentRepository = new DocumentRepository(prisma),
  ) {
    super(req);
  }

  async createRequest(dto: CreateDocumentRequestDto): Promise<DocumentRequest> {
    const business = await this.businessRepository.findById(dto.businessId, { tenantId: this.tenantId });
    this.validateExists(business, 'Business');

    this.logger.info({ businessId: dto.businessId, category: dto.category }, 'Creating document request');

    return this.repository.create(
      {
        businessId: dto.businessId,
        category: dto.category,
        description: dto.description ?? null,
        dueDate: dto.dueDate ?? null,
        requestedById: this.userId,
      },
      { tenantId: this.tenantId },
    );
  }

  async listRequests(query: ListDocumentRequestsQueryDto): Promise<{ data: DocumentRequest[]; meta: PaginationMeta }> {
    return this.repository.search(
      { businessId: query.businessId, category: query.category, status: query.status },
      { page: query.page, limit: query.limit, sortBy: query.sortBy, sortOrder: query.sortOrder },
      { tenantId: this.tenantId },
    );
  }

  async getRequestById(id: string): Promise<DocumentRequest> {
    const request = await this.repository.findById(id, { tenantId: this.tenantId });
    this.validateExists(request, 'DocumentRequest');
    return request;
  }

  async updateRequest(id: string, dto: UpdateDocumentRequestDto): Promise<DocumentRequest> {
    const existing = await this.getRequestById(id);
    if (existing.status !== DocumentRequestStatus.PENDING) {
      throw new ConflictError('Only a pending document request can be updated.');
    }

    this.logger.info({ requestId: id }, 'Updating document request');

    return this.repository.update(id, dto, { tenantId: this.tenantId });
  }

  async fulfillRequest(id: string, dto: FulfillDocumentRequestDto): Promise<DocumentRequest> {
    const existing = await this.getRequestById(id);
    if (existing.status !== DocumentRequestStatus.PENDING) {
      throw new ConflictError('Only a pending document request can be fulfilled.');
    }

    const document = await this.documentRepository.findById(dto.documentId, { tenantId: this.tenantId });
    this.validateExists(document, 'Document');

    this.logger.info({ requestId: id, documentId: dto.documentId }, 'Fulfilling document request');

    return this.repository.update(
      id,
      { status: DocumentRequestStatus.FULFILLED, fulfilledDocumentId: dto.documentId, fulfilledAt: new Date() },
      { tenantId: this.tenantId },
    );
  }

  async cancelRequest(id: string): Promise<DocumentRequest> {
    const existing = await this.getRequestById(id);
    if (existing.status !== DocumentRequestStatus.PENDING) {
      throw new ConflictError('Only a pending document request can be cancelled.');
    }

    this.logger.info({ requestId: id }, 'Cancelling document request');

    return this.repository.update(id, { status: DocumentRequestStatus.CANCELLED }, { tenantId: this.tenantId });
  }
}
