import { PaymentGatewayLink } from '@prisma/client';
import { PaymentLinkResponseDto } from '../dto/payment-link.res.dto';

export class PaymentLinkMapper {
  static toResponseDto(link: PaymentGatewayLink): PaymentLinkResponseDto {
    return {
      id: link.id,
      invoiceId: link.invoiceId,
      provider: link.provider,
      providerPaymentId: link.providerPaymentId,
      url: link.url,
      amountInPaise: link.amountInPaise,
      currency: link.currency,
      status: link.status,
      expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
      paymentId: link.paymentId,
      createdAt: link.createdAt.toISOString(),
    };
  }

  static toResponseDtoList(links: PaymentGatewayLink[]): PaymentLinkResponseDto[] {
    return links.map((link) => this.toResponseDto(link));
  }
}
