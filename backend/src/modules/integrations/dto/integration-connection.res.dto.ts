import { IntegrationConnectionStatus, IntegrationSyncDirection } from '@prisma/client';

export interface IntegrationConnectionResponseDto {
  id: string;
  providerKey: string;
  providerName: string;
  label: string | null;
  status: IntegrationConnectionStatus;
  /** Never the secret itself — mirrors `PaymentGatewaySettingsResponseDto`'s `hasKeySecret` boolean. */
  hasCredentials: boolean;
  scopes: string[];
  tokenExpiresAt: string | null;
  config: Record<string, unknown>;
  syncDirection: IntegrationSyncDirection;
  autoSyncEnabled: boolean;
  syncFrequencyMinutes: number | null;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  lastError: string | null;
  metadata: Record<string, unknown> | null;
  /** Computed, not stored — `${APP_URL}${API.PREFIX}/integrations/webhook/:providerKey/:connectionId`. */
  webhookUrl: string;
  createdAt: string;
  updatedAt: string;
}
