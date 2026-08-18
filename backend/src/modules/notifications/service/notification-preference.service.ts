import { Request } from 'express';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { NotificationPreferenceRepository } from '../repository/notification-preference.repository';
import { FirmNotificationSettingsRepository } from '../repository/firm-notification-settings.repository';
import { NotificationPreferenceMapper } from '../mapper/notification-preference.mapper';
import { NotificationPreferenceResponseDto, FirmNotificationSettingsResponseDto } from '../dto/notification-preference.res.dto';
import { UpdateNotificationPreferenceDto, UpdateFirmNotificationSettingsDto } from '../dto/notification-preference.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Notification Preference / Firm Settings Service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Two singletons, one service: the caller's own `NotificationPreference` row
 * (self-service, ungated — `getPreferences()`/`updatePreferences()`, mirrors
 * `DashboardPreferenceService`) and the tenant's `FirmNotificationSettings`
 * row (admin, gated by `NOTIFICATION_PERMISSIONS.READ`/`MANAGE` at the route
 * level — `getFirmSettings()`/`updateFirmSettings()`). Neither ever 404s for
 * a user/tenant that hasn't customized anything yet — the row simply
 * doesn't exist, which is normal first-run behavior; the mapper's defaults
 * mirror the Prisma schema's own column defaults.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class NotificationPreferenceService extends BaseService {
  constructor(
    req: Request,
    private readonly preferenceRepository: NotificationPreferenceRepository = new NotificationPreferenceRepository(prisma),
    private readonly firmSettingsRepository: FirmNotificationSettingsRepository = new FirmNotificationSettingsRepository(prisma),
  ) {
    super(req);
  }

  async getPreferences(): Promise<NotificationPreferenceResponseDto> {
    const preference = await this.preferenceRepository.findByUserId(this.userId as string);
    return NotificationPreferenceMapper.toResponseDto(preference);
  }

  async updatePreferences(dto: UpdateNotificationPreferenceDto): Promise<NotificationPreferenceResponseDto> {
    this.logger.info({ userId: this.userId }, 'Updating notification preferences');

    const preference = await this.preferenceRepository.upsert(this.tenantId as string, this.userId as string, dto);
    return NotificationPreferenceMapper.toResponseDto(preference);
  }

  async getFirmSettings(): Promise<FirmNotificationSettingsResponseDto> {
    const settings = await this.firmSettingsRepository.findByTenantId(this.tenantId as string);
    return NotificationPreferenceMapper.toFirmResponseDto(settings);
  }

  async updateFirmSettings(dto: UpdateFirmNotificationSettingsDto): Promise<FirmNotificationSettingsResponseDto> {
    this.logger.info({ tenantId: this.tenantId }, 'Updating firm notification settings');

    const settings = await this.firmSettingsRepository.upsert(this.tenantId as string, dto);
    return NotificationPreferenceMapper.toFirmResponseDto(settings);
  }
}
