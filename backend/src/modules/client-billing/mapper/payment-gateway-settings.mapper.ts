import { FirmPaymentGatewaySettings, PaymentGatewayProviderType } from '@prisma/client';
import { PaymentGatewaySettingsResponseDto } from '../dto/payment-gateway-settings.res.dto';

/** The one place `encryptedKeySecret`/`encryptedWebhookSecret` are read from a settings row and deliberately dropped, never forwarded. */
export class PaymentGatewaySettingsMapper {
  static toResponseDto(settings: FirmPaymentGatewaySettings): PaymentGatewaySettingsResponseDto {
    return {
      enabled: settings.enabled,
      provider: settings.provider,
      keyId: settings.keyId,
      hasKeySecret: Boolean(settings.encryptedKeySecret),
      hasWebhookSecret: Boolean(settings.encryptedWebhookSecret),
      isTestMode: settings.isTestMode,
      isActive: settings.isActive,
      createdBy: settings.createdBy,
      updatedBy: settings.updatedBy,
      createdAt: settings.createdAt.toISOString(),
      updatedAt: settings.updatedAt.toISOString(),
    };
  }

  /** The default shape for a tenant with no row yet — `PaymentGatewaySettingsService.getSettings()` returns this rather than a 404, mirroring `TenantStorageSettingsService`'s "a settings singleton always reads, even before its first write" precedent. */
  static toDefaultResponseDto(): PaymentGatewaySettingsResponseDto {
    return {
      enabled: false,
      provider: PaymentGatewayProviderType.DISABLED,
      keyId: null,
      hasKeySecret: false,
      hasWebhookSecret: false,
      isTestMode: true,
      isActive: false,
      createdBy: null,
      updatedBy: null,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    };
  }
}
