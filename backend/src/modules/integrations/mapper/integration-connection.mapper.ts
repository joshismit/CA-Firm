import { IntegrationConnection } from '@prisma/client';
import { env } from '@config/environment';
import { API } from '@shared/constants';
import { IntegrationConnectionResponseDto } from '../dto';

/** The one place `encryptedCredentials` is read from a connection row and deliberately
 *  dropped, never forwarded — mirrors `PaymentGatewaySettingsMapper`'s same convention. */
export class IntegrationConnectionMapper {
  static toResponseDto(connection: IntegrationConnection, providerName: string): IntegrationConnectionResponseDto {
    return {
      id: connection.id,
      providerKey: connection.providerKey,
      providerName,
      label: connection.label,
      status: connection.status,
      hasCredentials: Boolean(connection.encryptedCredentials),
      scopes: connection.scopes,
      tokenExpiresAt: connection.tokenExpiresAt?.toISOString() ?? null,
      config: (connection.config as Record<string, unknown>) ?? {},
      syncDirection: connection.syncDirection,
      autoSyncEnabled: connection.autoSyncEnabled,
      syncFrequencyMinutes: connection.syncFrequencyMinutes,
      lastSyncAt: connection.lastSyncAt?.toISOString() ?? null,
      nextSyncAt: connection.nextSyncAt?.toISOString() ?? null,
      lastError: connection.lastError,
      metadata: (connection.metadata as Record<string, unknown> | null) ?? null,
      webhookUrl: `${env.APP_URL}${API.PREFIX}/integrations/webhook/${connection.providerKey}/${connection.id}`,
      createdAt: connection.createdAt.toISOString(),
      updatedAt: connection.updatedAt.toISOString(),
    };
  }
}
