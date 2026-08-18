import { Payment } from '@prisma/client';
import { PaymentResponseDto } from '../dto/payment.res.dto';

/** Entity ⇄ DTO mapper for `Payment`. Controllers/services must always return data through this mapper — never serialize a raw Prisma row. */
export class PaymentMapper {
  static toResponseDto(payment: Payment): PaymentResponseDto {
    return {
      id: payment.id,
      paymentNumber: payment.paymentNumber,
      invoiceId: payment.invoiceId,
      amount: payment.amount.toNumber(),
      method: payment.method,
      reference: payment.reference,
      paidDate: payment.paidDate ? payment.paidDate.toISOString() : null,
      status: payment.status,
      notes: payment.notes,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
    };
  }

  static toResponseDtoList(payments: Payment[]): PaymentResponseDto[] {
    return payments.map((payment) => this.toResponseDto(payment));
  }
}
