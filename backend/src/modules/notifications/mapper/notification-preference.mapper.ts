import { NotificationDigestFrequency, NotificationPreference, FirmNotificationSettings } from '@prisma/client';
import { NotificationPreferenceResponseDto, FirmNotificationSettingsResponseDto } from '../dto/notification-preference.res.dto';

/** Every brand-new user/tenant defaults to these values — the same defaults the Prisma schema's `@default(...)` columns carry, mirrored here for the row-doesn't-exist-yet case (see `NotificationPreferenceService.getPreferences()`). */
export class NotificationPreferenceMapper {
  static toResponseDto(preference: NotificationPreference | null): NotificationPreferenceResponseDto {
    if (!preference) {
      return {
        emailEnabled: true,
        smsEnabled: true,
        whatsappEnabled: true,
        digestFrequency: NotificationDigestFrequency.IMMEDIATE,
        quietHoursStart: null,
        quietHoursEnd: null,
        muteUntil: null,
        updatedAt: null,
      };
    }

    return {
      emailEnabled: preference.emailEnabled,
      smsEnabled: preference.smsEnabled,
      whatsappEnabled: preference.whatsappEnabled,
      digestFrequency: preference.digestFrequency,
      quietHoursStart: preference.quietHoursStart,
      quietHoursEnd: preference.quietHoursEnd,
      muteUntil: preference.muteUntil?.toISOString() ?? null,
      updatedAt: preference.updatedAt.toISOString(),
    };
  }

  static toFirmResponseDto(settings: FirmNotificationSettings | null): FirmNotificationSettingsResponseDto {
    if (!settings) {
      return {
        emailEnabled: true,
        smsEnabled: false,
        whatsappEnabled: false,
        defaultQuietHoursStart: null,
        defaultQuietHoursEnd: null,
        updatedAt: null,
      };
    }

    return {
      emailEnabled: settings.emailEnabled,
      smsEnabled: settings.smsEnabled,
      whatsappEnabled: settings.whatsappEnabled,
      defaultQuietHoursStart: settings.defaultQuietHoursStart,
      defaultQuietHoursEnd: settings.defaultQuietHoursEnd,
      updatedAt: settings.updatedAt.toISOString(),
    };
  }
}
