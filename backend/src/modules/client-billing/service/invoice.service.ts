import { Request } from 'express';
import { Invoice, InvoiceStatus, AuditEventType } from '@prisma/client';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { NotFoundError } from '@shared/errors';
import { PaginationMeta, PaginationQuery } from '@shared/types';
import { AuditLogRecorder } from '@modules/audit';
import { InvoiceRepository, InvoiceSearchFilters } from '../repository/invoice.repository';
import { CreateInvoiceDto, UpdateInvoiceDto, ListInvoicesQueryDto } from '../dto/invoice.req.dto';

/** `Invoice` with its `business` relation eager-loaded — the shape `searchForDashboard()` always returns (it always requests that include). */
export interface InvoiceWithBusiness extends Invoice {
  business: { id: string; name: string } | null;
}

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
    private readonly auditLogRecorder: AuditLogRecorder = new AuditLogRecorder(),
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

    const invoice = await this.repository.create(
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

    if (this.userId && this.tenantId) {
      await this.auditLogRecorder.record({
        tenantId: this.tenantId,
        actorId: this.userId,
        eventType: AuditEventType.INVOICE_CREATED,
        description: `Created invoice "${invoice.invoiceNumber}"`,
        targetType: 'Invoice',
        targetId: invoice.id,
        ipAddress: this.req.ip ?? null,
        userAgent: (this.req.headers?.['user-agent'] as string | undefined) ?? null,
        newValue: { amount: invoice.amount.toString(), status: invoice.status },
      });
    }

    return invoice;
  }

  async updateInvoice(id: string, dto: UpdateInvoiceDto): Promise<Invoice> {
    const existing = await this.getInvoiceById(id);
    await this.validateReferences(dto);

    this.logger.info({ invoiceId: id }, 'Updating invoice');

    const updated = await this.repository.update(id, dto, { tenantId: this.tenantId });

    if (this.userId && this.tenantId) {
      await this.auditLogRecorder.record({
        tenantId: this.tenantId,
        actorId: this.userId,
        eventType: AuditEventType.INVOICE_UPDATED,
        description: `Updated invoice "${updated.invoiceNumber}"`,
        targetType: 'Invoice',
        targetId: updated.id,
        ipAddress: this.req.ip ?? null,
        userAgent: (this.req.headers?.['user-agent'] as string | undefined) ?? null,
        oldValue: {
          amount: existing.amount.toString(),
          tax: existing.tax.toString(),
          dueDate: existing.dueDate?.toISOString() ?? null,
          notes: existing.notes,
        },
        newValue: {
          amount: updated.amount.toString(),
          tax: updated.tax.toString(),
          dueDate: updated.dueDate?.toISOString() ?? null,
          notes: updated.notes,
        },
      });
    }

    return updated;
  }

  async deleteInvoice(id: string): Promise<void> {
    const existing = await this.getInvoiceById(id);

    this.logger.info({ invoiceId: id }, 'Deleting invoice');

    await this.repository.delete(id, { tenantId: this.tenantId });

    if (this.userId && this.tenantId) {
      await this.auditLogRecorder.record({
        tenantId: this.tenantId,
        actorId: this.userId,
        eventType: AuditEventType.INVOICE_DELETED,
        description: `Deleted invoice "${existing.invoiceNumber}"`,
        targetType: 'Invoice',
        targetId: existing.id,
        ipAddress: this.req.ip ?? null,
        userAgent: (this.req.headers?.['user-agent'] as string | undefined) ?? null,
        oldValue: { amount: existing.amount.toString(), status: existing.status },
      });
    }
  }

  /**
   * PRD §10.5 — thin, tenant-scoped passthrough to `InvoiceRepository.search()` for the
   * Dashboard's "Outstanding Payments"/"Payment Reminders"/Calendar widgets
   * (`DashboardAggregationService` composes via this Service, never the repository
   * directly — see `modules/client-billing/index.ts`'s header comment).
   */
  async searchForDashboard(
    filters: InvoiceSearchFilters,
    pagination: PaginationQuery,
  ): Promise<{ data: InvoiceWithBusiness[]; meta: PaginationMeta }> {
    const { data, meta } = await this.repository.search(
      filters,
      pagination,
      { tenantId: this.tenantId },
      { business: { select: { id: true, name: true } } },
    );
    return { data: data as unknown as InvoiceWithBusiness[], meta };
  }

  /**
   * PRD §10.7 — "Outstanding Payments" count/total + Performance's revenue rollup.
   * Known limitation: `InvoiceStatus.OVERDUE` is never set by any write path in this
   * codebase today (see `DashboardAggregationService`'s header comment) — this will
   * only ever reflect whichever of the requested statuses are actually reachable.
   */
  async sumOutstanding(filters: { statusIn: InvoiceStatus[]; businessIdIn?: string[] }): Promise<{ count: number; totalAmount: number }> {
    return this.repository.sumAmountByStatus(filters, { tenantId: this.tenantId });
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
