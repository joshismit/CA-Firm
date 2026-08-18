import { PrismaClient, FirmNotificationSettings } from '@prisma/client';

/**
 * One-row-per-tenant singleton, same reasoning as
 * `NotificationPreferenceRepository`'s header comment but keyed on `tenantId`
 * instead of `userId`.
 */
export class FirmNotificationSettingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByTenantId(tenantId: string): Promise<FirmNotificationSettings | null> {
    return this.prisma.firmNotificationSettings.findUnique({ where: { tenantId } });
  }

  async upsert(
    tenantId: string,
    data: Partial<
      Pick<FirmNotificationSettings, 'emailEnabled' | 'smsEnabled' | 'whatsappEnabled' | 'defaultQuietHoursStart' | 'defaultQuietHoursEnd'>
    >,
  ): Promise<FirmNotificationSettings> {
    return this.prisma.firmNotificationSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...data },
      update: data,
    });
  }
}
