import { IntegrationCategory, IntegrationSyncDirection } from '@prisma/client';
import { integrationProviderRegistry } from '@modules/integrations/providers/integration-provider.registry';
import { DisabledIntegrationProvider } from '@modules/integrations/providers/disabled-integration.provider';
import { IntegrationProvider } from '@modules/integrations/providers/integration-provider.interface';

/**
 * `integrationProviderRegistry` is a module-level singleton (by design — see
 * its own header comment), so every test here registers under a UNIQUE key
 * rather than sharing one across `it()` blocks, keeping tests independent
 * without needing to reset module state between them.
 */
function uniqueKey(label: string): string {
  return `test-${label}-${Math.random().toString(36).slice(2, 10)}`;
}

function fakeProvider(key: string): IntegrationProvider {
  return {
    key,
    isConfigured: true,
    connect: jest.fn(),
    disconnect: jest.fn(),
    refreshToken: jest.fn(),
    health: jest.fn(),
    sync: jest.fn(),
    validate: jest.fn(),
    supports: jest.fn(),
    getCapabilities: jest.fn(),
    webhook: jest.fn(),
  } as unknown as IntegrationProvider;
}

const CAPABILITIES = {
  category: IntegrationCategory.ACCOUNTING,
  supportsSync: true,
  supportsWebhooks: true,
  supportsOAuth: false,
  supportedSyncDirections: [IntegrationSyncDirection.IMPORT],
};

describe('integrationProviderRegistry', () => {
  it('resolves an unregistered key to DisabledIntegrationProvider, never null/undefined', () => {
    const key = uniqueKey('unregistered');
    const provider = integrationProviderRegistry.resolve(key, {
      connectionId: 'c1',
      tenantId: 't1',
      credentials: { apiKey: 'x' },
      config: {},
    });
    expect(provider).toBeInstanceOf(DisabledIntegrationProvider);
    expect(provider.isConfigured).toBe(false);
  });

  it('resolves a registered key by invoking its factory once credentials are present', () => {
    const key = uniqueKey('registered');
    const built = fakeProvider(key);
    const factory = jest.fn().mockReturnValue(built);
    integrationProviderRegistry.register(key, factory, { name: 'Test Provider', capabilities: CAPABILITIES });

    const context = { connectionId: 'c1', tenantId: 't1', credentials: { apiKey: 'x' }, config: {} };
    const resolved = integrationProviderRegistry.resolve(key, context);

    expect(factory).toHaveBeenCalledWith(context);
    expect(resolved).toBe(built);
  });

  it('falls back to DisabledIntegrationProvider when a registered provider has no credentials yet', () => {
    const key = uniqueKey('no-creds');
    integrationProviderRegistry.register(key, jest.fn(), { name: 'Test Provider', capabilities: CAPABILITIES });

    const provider = integrationProviderRegistry.resolve(key, { connectionId: 'c1', tenantId: 't1', credentials: null, config: {} });
    expect(provider).toBeInstanceOf(DisabledIntegrationProvider);
  });

  it('throws on a duplicate key so two providers can never silently shadow each other', () => {
    const key = uniqueKey('duplicate');
    integrationProviderRegistry.register(key, jest.fn(), { name: 'First', capabilities: CAPABILITIES });
    expect(() => integrationProviderRegistry.register(key, jest.fn(), { name: 'Second', capabilities: CAPABILITIES })).toThrow(
      /already registered/,
    );
  });

  it('isRegistered/listKeys/getMetadata reflect registration state', () => {
    const key = uniqueKey('metadata');
    expect(integrationProviderRegistry.isRegistered(key)).toBe(false);
    expect(integrationProviderRegistry.listKeys()).not.toContain(key);

    integrationProviderRegistry.register(key, jest.fn(), { name: 'Test Provider', description: 'Accounting sync', capabilities: CAPABILITIES });

    expect(integrationProviderRegistry.isRegistered(key)).toBe(true);
    expect(integrationProviderRegistry.listKeys()).toContain(key);
    expect(integrationProviderRegistry.getMetadata(key)).toEqual({
      name: 'Test Provider',
      description: 'Accounting sync',
      capabilities: CAPABILITIES,
    });
  });
});
