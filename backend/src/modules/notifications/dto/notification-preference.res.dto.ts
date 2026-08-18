import { NotificationDigestFrequency } from '@prisma/client';

export interface NotificationPreferenceResponseDto {
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  digestFrequency: NotificationDigestFrequency;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  muteUntil: string | null;
  updatedAt: string | null;
}

export interface FirmNotificationSettingsResponseDto {
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  defaultQuietHoursStart: number | null;
  defaultQuietHoursEnd: number | null;
  updatedAt: string | null;
}
