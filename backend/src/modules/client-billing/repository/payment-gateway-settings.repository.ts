import { PrismaClient, FirmPaymentGatewaySettings, PaymentGatewayProviderType } from '@prisma/client';

export interface UpsertPaymentGatewaySettingsData {
  enabled: boolean;
  provider: PaymentGatewayProviderType;
  keyId: string | null;
  encryptedKeySecret: string | null;
  encryptedWebhookSecret: string | null;
  isTestMode: boolean;
  isActive: boolean;
  updatedBy: string | null;
}

/**
 * One-row-per-tenant singleton — mirrors
 * `modules/notifications/repository/firm-notification-settings.repository.ts`
 * exactly, keyed on `tenantId` the same way. Deliberately does NOT extend
 * `BaseRepository`: every real operation here is "find/create-or-update the
 * one row for this tenant," not a generic multi-row CRUD surface.
 */
export class PaymentGatewaySettingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByTenantId(tenantId: string): Promise<FirmPaymentGatewaySettings | null> {
    return this.prisma.firmPaymentGatewaySettings.findUnique({ where: { tenantId } });
  }

  async upsert(tenantId: string, data: UpsertPaymentGatewaySettingsData, createdBy: string | null): Promise<FirmPaymentGatewaySettings> {
    return this.prisma.firmPaymentGatewaySettings.upsert({
      where: { tenantId },
      create: { tenantId, ...data, createdBy },
      update: data,
    });
  }
}
