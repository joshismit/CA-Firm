import { PaymentGatewayProviderType, PaymentGatewayLinkStatus } from '@prisma/client';

export interface PaymentLinkResponseDto {
  id: string;
  invoiceId: string;
  provider: PaymentGatewayProviderType;
  providerPaymentId: string;
  url: string;
  amountInPaise: number;
  currency: string;
  status: PaymentGatewayLinkStatus;
  expiresAt: string | null;
  paymentId: string | null;
  createdAt: string;
}
