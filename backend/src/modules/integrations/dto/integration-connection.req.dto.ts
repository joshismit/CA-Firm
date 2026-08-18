import { IntegrationSyncDirection } from '@prisma/client';

export interface ConnectIntegrationDto {
  providerKey: string;
  /** When set, rotates credentials/config on an EXISTING connection (must belong to this tenant
   *  and match `providerKey`) instead of creating a new one — the only way to update a connection's
   *  credentials, since there is no separate `PATCH` endpoint (PRD §17 Step 9 lists none). */
  connectionId?: string;
  label?: string;
  /** Opaque credential bag — the framework encrypts it as-is and never inspects its shape, see
   *  `IntegrationConnectionService.connect()`. */
  credentials: Record<string, unknown>;
  config?: Record<string, unknown>;
  syncDirection?: IntegrationSyncDirection;
  autoSyncEnabled?: boolean;
  syncFrequencyMinutes?: number;
}

export interface DisconnectIntegrationDto {
  connectionId: string;
}

export interface TriggerSyncDto {
  connectionId: string;
  direction?: IntegrationSyncDirection;
  isDryRun?: boolean;
}

export interface ListConnectionsQueryDto {
  providerKey?: string;
}

export interface SyncHistoryQueryDto {
  connectionId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface HealthQueryDto {
  connectionId: string;
}
