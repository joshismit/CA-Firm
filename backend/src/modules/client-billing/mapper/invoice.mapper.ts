import { Invoice } from '@prisma/client';
import { InvoiceResponseDto } from '../dto/invoice.res.dto';

/**
 * Entity ⇄ DTO mapper for `Invoice`. Controllers/services must always
 * return data through this mapper — never serialize a raw Prisma row
 * (`amount`/`tax` are Prisma `Decimal`, converted to plain numbers here —
 * same precedent as `ContactMapper`'s `sharePercent.toNumber()`).
 */
export class InvoiceMapper {
  static toResponseDto(invoice: Invoice): InvoiceResponseDto {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientId: invoice.clientId,
      businessId: invoice.businessId,
      amount: invoice.amount.toNumber(),
      tax: invoice.tax.toNumber(),
      issuedDate: invoice.issuedDate ? invoice.issuedDate.toISOString() : null,
      dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : null,
      status: invoice.status,
      notes: invoice.notes,
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
    };
  }

  static toResponseDtoList(invoices: Invoice[]): InvoiceResponseDto[] {
    return invoices.map((invoice) => this.toResponseDto(invoice));
  }
}
