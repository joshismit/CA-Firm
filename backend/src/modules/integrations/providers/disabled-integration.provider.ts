import { IntegrationCategory, IntegrationSyncDirection } from '@prisma/client';
import { ServiceUnavailableError } from '@shared/errors';
import { ErrorCode } from '@shared/enums';
import {
  IntegrationProvider,
  IntegrationConnectResult,
  IntegrationDisconnectResult,
  IntegrationTokenRefreshResult,
  IntegrationHealth,
  IntegrationSyncResult,
  IntegrationValidateResult,
  IntegrationCapabilities,
  IntegrationWebhookResult,
} from './integration-provider.interface';

/**
 * The provider returned by `IntegrationProviderRegistry.resolve()` for any
 * `providerKey` that isn't registered yet (i.e. every real provider today —
 * PRD §17 builds the framework only) or whose connection has no working
 * credentials — every method short-circuits without a network call, exactly
 * mirroring `DisabledGatewayProvider`/`modules/client-billing`'s null-object
 * pattern, so callers never null-check a provider, they just check `isConfigured`.
 */
export class DisabledIntegrationProvider implements IntegrationProvider {
  readonly key: string;
  readonly isConfigured = false;

  constructor(key = 'disabled') {
    this.key = key;
  }

  async connect(): Promise<IntegrationConnectResult> {
    throw new ServiceUnavailableError(
      `No integration provider is registered for "${this.key}" yet`,
      ErrorCode.INTEGRATION_PROVIDER_NOT_FOUND,
    );
  }

  async disconnect(): Promise<IntegrationDisconnectResult> {
    return { success: true };
  }

  async refreshToken(): Promise<IntegrationTokenRefreshResult> {
    return { success: false, error: `No integration provider is registered for "${this.key}" yet` };
  }

  getCapabilities(): IntegrationCapabilities {
    return {
      category: IntegrationCategory.OTHER,
      supportsSync: false,
      supportsWebhooks: false,
      supportsOAuth: false,
      supportedSyncDirections: [] as IntegrationSyncDirection[],
    };
  }

  supports(capability: keyof IntegrationCapabilities): boolean {
    const value = this.getCapabilities()[capability];
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  }

  async health(): Promise<IntegrationHealth> {
    return { status: 'unconfigured', checkedAt: new Date().toISOString() };
  }

  async sync(): Promise<IntegrationSyncResult> {
    return {
      success: false,
      itemsProcessed: 0,
      itemsSucceeded: 0,
      itemsFailed: 0,
      error: `No integration provider is registered for "${this.key}" yet`,
    };
  }

  async validate(): Promise<IntegrationValidateResult> {
    return { valid: false, reason: `No integration provider is registered for "${this.key}" yet` };
  }

  async webhook(): Promise<IntegrationWebhookResult> {
    return { valid: false, shouldProcess: false, error: `No integration provider is registered for "${this.key}" yet` };
  }
}
