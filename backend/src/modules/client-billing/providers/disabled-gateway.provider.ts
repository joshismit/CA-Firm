import { PaymentGatewayProviderType } from '@prisma/client';
import { ServiceUnavailableError } from '@shared/errors';
import { ErrorCode } from '@shared/enums';
import {
  PaymentGatewayProvider,
  PaymentGatewayCapabilities,
  PaymentGatewayHealth,
  InitializePaymentResult,
  VerifyPaymentResult,
  RefundResult,
} from './payment-gateway-provider.interface';

/**
 * The default provider for any firm that hasn't turned on client payment
 * collection yet, or has explicitly set `provider: DISABLED` — every method
 * short-circuits without a network call, mirroring `DisabledGatewayProvider`'s
 * counterpart pattern (`NotificationProvider`'s `isConfigured` guard) rather
 * than leaving `resolveFromSettings()` return `null` and pushing a null-check
 * onto every caller.
 */
export class DisabledGatewayProvider implements PaymentGatewayProvider {
  readonly type = PaymentGatewayProviderType.DISABLED;
  readonly isConfigured = false;

  async initializePayment(): Promise<InitializePaymentResult> {
    throw new ServiceUnavailableError(
      'No payment gateway is configured for this firm yet',
      ErrorCode.DEPENDENCY_UNAVAILABLE,
    );
  }

  async verifyPayment(): Promise<VerifyPaymentResult> {
    return { verified: false, status: 'FAILED' };
  }

  async refund(): Promise<RefundResult> {
    return { success: false, error: 'No payment gateway is configured for this firm yet' };
  }

  getCapabilities(): PaymentGatewayCapabilities {
    return { supportsPaymentLinks: false, supportsRefunds: false, supportsPartialPayments: false, supportedCurrencies: [] };
  }

  async healthCheck(): Promise<PaymentGatewayHealth> {
    return { status: 'unconfigured', checkedAt: new Date().toISOString() };
  }

  verifyWebhookSignature(_rawBody: Buffer, _signature: string): boolean {
    return false;
  }
}
