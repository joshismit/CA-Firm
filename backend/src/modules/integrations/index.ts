// integrations module — public exports (PRD §17 — Integration Framework)
//
// Only the module's actual public surface is exported here: the two routers
// (for mounting) and the provider extension point — mirrors `modules/client-billing`'s
// `index.ts` shape exactly. Repositories/controllers/mappers/the concrete
// services stay internal; a FUTURE provider module (e.g. `providers/tally.provider.ts`,
// which would NOT live under `modules/integrations` but wherever that
// provider's own code lives) only ever needs `integrationProviderRegistry`
// and the types re-exported from `providers/` below — never anything else
// from this module.

export { default as integrationRoutes } from './routes/integration.routes';
export { default as integrationWebhookRoutes } from './routes/integration-webhook.routes';
export { INTEGRATION_PERMISSIONS } from './constants/integration.permissions';
export { syncIntegrationProviderCatalog } from './service';

// The extension point (PRD §17 Step 3) — everything a future provider module needs.
export {
  integrationProviderRegistry,
  DisabledIntegrationProvider,
} from './providers';
export type {
  IntegrationProvider,
  IntegrationProviderContext,
  IntegrationProviderFactory,
  IntegrationProviderMetadata,
  IntegrationCredentials,
  IntegrationConnectParams,
  IntegrationConnectResult,
  IntegrationDisconnectResult,
  IntegrationTokenRefreshResult,
  IntegrationHealth,
  IntegrationSyncParams,
  IntegrationSyncResult,
  IntegrationValidateResult,
  IntegrationCapabilities,
  IntegrationWebhookEvent,
  IntegrationWebhookResult,
} from './providers';

export type { IntegrationConnectionResponseDto } from './dto/integration-connection.res.dto';
export type { IntegrationProviderResponseDto } from './dto/integration-provider.res.dto';
export type { IntegrationSyncResponseDto } from './dto/integration-sync.res.dto';
