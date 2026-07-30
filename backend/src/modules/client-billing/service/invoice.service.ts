import { Request } from 'express';
import { Invoice } from '@prisma/client';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { NotFoundError } from '@shared/errors';
import { PaginationMeta } from '@shared/types';
import { InvoiceRepository } from '../repository/invoice.repository';
import { CreateInvoiceDto, UpdateInvoiceDto, ListInvoicesQueryDto } from '../dto/invoice.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Invoice Service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Business logic for `Invoice`. No HTTP concerns — the controller passes
 * plain values in and gets domain entities back, exactly like every other
 * module's service. Mirrors `modules/contacts/service/contact.service.ts`.
 *
 * `clientId`/`businessId` are validated to belong to the caller's tenant
 * before create/update — the FK constraint alone would not catch a
 * cross-tenant reference (the Client/Business row exists, just in a
 * different tenant), same reasoning as `RoleService.assignRole()`'s
 * cross-tenant `userId` guard.
 *
 * `status`/`issuedDate` are stored on the model (the frontend's response
 * type reads both) but neither `CreateInvoiceDto` nor `UpdateInvoiceDto`
 * ever carries them — the frontend's own `InvoiceForm` never collects
 * either. Every invoice is therefore created as `DRAFT` with no
 * `issuedDate`, and stays that way through this API — there is no
 * status-transition endpoint to build, because the frontend never asks for
 * one (same known limitation as the Compliance module).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class InvoiceService extends BaseService {
  constructor(
    req: Request,
    private readonly repository: InvoiceRepository = new InvoiceRepository(prisma),
  ) {
    super(req);
  }

  async listInvoices(query: ListInvoicesQueryDto): Promise<{ data: Invoice[]; meta: PaginationMeta }> {
    return this.repository.search(
      { search: query.search, status: query.status },
      { page: query.page, limit: query.limit, sortBy: query.sortBy, sortOrder: query.sortOrder },
      { tenantId: this.tenantId },
    );
  }

  async getInvoiceById(id: string): Promise<Invoice> {
    const invoice = await this.repository.findById(id, { tenantId: this.tenantId });
    this.validateExists(invoice, 'Invoice');
    return invoice;
  }

  async createInvoice(dto: CreateInvoiceDto): Promise<Invoice> {
    await this.validateReferences(dto);

    this.logger.info({ invoiceNumber: dto.invoiceNumber }, 'Creating invoice');

    return this.repository.create(
      {
        invoiceNumber: dto.invoiceNumber,
        clientId: dto.clientId ?? null,
        businessId: dto.businessId ?? null,
        amount: dto.amount,
        tax: dto.tax ?? 0,
        dueDate: dto.dueDate ?? null,
        notes: dto.notes ?? null,
      },
      { tenantId: this.tenantId },
    );
  }

  async updateInvoice(id: string, dto: UpdateInvoiceDto): Promise<Invoice> {
    await this.getInvoiceById(id);
    await this.validateReferences(dto);

    this.logger.info({ invoiceId: id }, 'Updating invoice');

    return this.repository.update(id, dto, { tenantId: this.tenantId });
  }

  async deleteInvoice(id: string): Promise<void> {
    await this.getInvoiceById(id);

    this.logger.info({ invoiceId: id }, 'Deleting invoice');

    await this.repository.delete(id, { tenantId: this.tenantId });
  }

  private async validateReferences(dto: CreateInvoiceDto | UpdateInvoiceDto): Promise<void> {
    const tenantId = this.tenantId as string;

    if (dto.clientId) {
      const exists = await this.repository.clientExistsInTenant(dto.clientId, tenantId);
      if (!exists) throw new NotFoundError('Client');
    }
    if (dto.businessId) {
      const exists = await this.repository.businessExistsInTenant(dto.businessId, tenantId);
      if (!exists) throw new NotFoundError('Business');
    }
  }
}
