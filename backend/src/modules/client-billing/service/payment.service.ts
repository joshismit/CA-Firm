import { Request } from 'express';
import { Payment } from '@prisma/client';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { NotFoundError } from '@shared/errors';
import { PaginationMeta } from '@shared/types';
import { PaymentRepository } from '../repository/payment.repository';
import { InvoiceRepository } from '../repository/invoice.repository';
import { CreatePaymentDto, UpdatePaymentDto, ListPaymentsQueryDto } from '../dto/payment.req.dto';

/**
 * Business logic for `Payment`. `invoiceId` is validated to belong to the
 * caller's tenant before create/update, via `InvoiceRepository` directly
 * (same module — not a cross-module repository reach, unlike
 * `InvoiceService`'s Client/Business checks, which reach into other
 * modules' tables instead). Otherwise mirrors
 * `modules/client-billing/service/invoice.service.ts` exactly. `status` is
 * stored (defaults PENDING) but not user-settable — same known limitation
 * as Invoice/Expense/Compliance.
 */
export class PaymentService extends BaseService {
  constructor(
    req: Request,
    private readonly repository: PaymentRepository = new PaymentRepository(prisma),
    private readonly invoiceRepository: InvoiceRepository = new InvoiceRepository(prisma),
  ) {
    super(req);
  }

  async listPayments(query: ListPaymentsQueryDto): Promise<{ data: Payment[]; meta: PaginationMeta }> {
    return this.repository.search(
      { search: query.search, status: query.status },
      { page: query.page, limit: query.limit, sortBy: query.sortBy, sortOrder: query.sortOrder },
      { tenantId: this.tenantId },
    );
  }

  async getPaymentById(id: string): Promise<Payment> {
    const payment = await this.repository.findById(id, { tenantId: this.tenantId });
    this.validateExists(payment, 'Payment');
    return payment;
  }

  async createPayment(dto: CreatePaymentDto): Promise<Payment> {
    await this.validateInvoiceReference(dto.invoiceId);

    this.logger.info({ paymentNumber: dto.paymentNumber }, 'Creating payment');

    return this.repository.create(
      {
        paymentNumber: dto.paymentNumber,
        invoiceId: dto.invoiceId ?? null,
        amount: dto.amount,
        method: dto.method ?? null,
        reference: dto.reference ?? null,
        paidDate: dto.paidDate ?? null,
        notes: dto.notes ?? null,
      },
      { tenantId: this.tenantId },
    );
  }

  async updatePayment(id: string, dto: UpdatePaymentDto): Promise<Payment> {
    await this.getPaymentById(id);
    await this.validateInvoiceReference(dto.invoiceId);

    this.logger.info({ paymentId: id }, 'Updating payment');

    return this.repository.update(id, dto, { tenantId: this.tenantId });
  }

  async deletePayment(id: string): Promise<void> {
    await this.getPaymentById(id);

    this.logger.info({ paymentId: id }, 'Deleting payment');

    await this.repository.delete(id, { tenantId: this.tenantId });
  }

  private async validateInvoiceReference(invoiceId: string | undefined): Promise<void> {
    if (!invoiceId) return;
    const invoice = await this.invoiceRepository.findById(invoiceId, { tenantId: this.tenantId });
    if (!invoice) throw new NotFoundError('Invoice');
  }
}
