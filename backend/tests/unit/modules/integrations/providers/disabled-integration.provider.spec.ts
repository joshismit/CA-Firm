import { DisabledIntegrationProvider } from '@modules/integrations/providers/disabled-integration.provider';
import { ServiceUnavailableError } from '@shared/errors';

describe('DisabledIntegrationProvider', () => {
  it('is never configured', () => {
    expect(new DisabledIntegrationProvider('tally').isConfigured).toBe(false);
  });

  it('connect() throws — the one method with no safe no-op result', async () => {
    const provider = new DisabledIntegrationProvider('tally');
    await expect(provider.connect()).rejects.toThrow(ServiceUnavailableError);
  });

  it('every other method short-circuits with a result object, never a network call or a throw', async () => {
    const provider = new DisabledIntegrationProvider('tally');

    await expect(provider.disconnect()).resolves.toEqual({ success: true });
    await expect(provider.refreshToken()).resolves.toMatchObject({ success: false });
    await expect(provider.sync()).resolves.toMatchObject({ success: false, itemsProcessed: 0, itemsSucceeded: 0, itemsFailed: 0 });
    await expect(provider.validate()).resolves.toMatchObject({ valid: false });
    await expect(provider.webhook()).resolves.toMatchObject({ valid: false, shouldProcess: false });

    const health = await provider.health();
    expect(health.status).toBe('unconfigured');
  });

  it('getCapabilities()/supports() report everything unsupported', () => {
    const provider = new DisabledIntegrationProvider('tally');
    const capabilities = provider.getCapabilities();

    expect(capabilities).toMatchObject({ supportsSync: false, supportsWebhooks: false, supportsOAuth: false, supportedSyncDirections: [] });
    expect(provider.supports('supportsSync')).toBe(false);
    expect(provider.supports('supportsWebhooks')).toBe(false);
  });
});
