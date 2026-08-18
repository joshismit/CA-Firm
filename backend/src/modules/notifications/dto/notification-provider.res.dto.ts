import { NotificationChannel } from '@prisma/client';
import { NotificationProviderCapabilities, NotificationProviderHealth } from '../providers/notification-provider.interface';

export interface NotificationProviderResponseDto {
  channel: NotificationChannel;
  isConfigured: boolean;
  capabilities: NotificationProviderCapabilities;
}

export interface NotificationProviderHealthResponseDto {
  channel: NotificationChannel;
  health: NotificationProviderHealth;
}
