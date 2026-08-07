import { IntegrationProvider, IntegrationCredentials, IntegrationCapabilities } from './integration-provider.interface';
import { DisabledIntegrationProvider } from './disabled-integration.provider';

/**
 * Everything one `IntegrationProvider` factory needs to build itself for ONE
 * `IntegrationConnection` — `credentials`/`config` are already decrypted/parsed
 * by `IntegrationConnectionService` before this is constructed; a factory never
 * touches Prisma or `CryptoUtils` itself.
 */
export interface IntegrationProviderContext {
  connectionId: string;
  tenantId: string;
  /** `null` when the connection has no stored credentials yet (e.g. mid-OAuth-flow, or never connected). */
  credentials: IntegrationCredentials | null;
  config: Record<string, unknown>;
}

export type IntegrationProviderFactory = (context: IntegrationProviderContext) => IntegrationProvider;

/** Static, non-network-dependent metadata a provider registers alongside its factory —
 *  backs the `IntegrationProvider` (Prisma catalog) row `syncProviderCatalog()` upserts. */
export interface IntegrationProviderMetadata {
  name: string;
  description?: string;
  capabilities: IntegrationCapabilities;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Integration Provider Registry (PRD §17 Step 3 — the extension point)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Deliberately a register/resolve MAP, not the static switch-statement factory
 * `modules/client-billing/providers/index.ts` (`resolvePaymentGatewayProvider`)
 * uses. Payment gateways are a small, closed set the platform ships with; PRD
 * §17's whole point is the opposite — a provider must be addable LATER without
 * editing any file this framework ships. A switch statement requires editing
 * the switch; a registry does not: a new provider module calls
 * `integrationProviderRegistry.register('tally', factory)` once, from its own
 * file, and `IntegrationConnectionService`/the sync engine/the webhook
 * controller pick it up automatically on the next `resolve()` call — they
 * never branch on a provider key themselves.
 *
 * No real provider registers here yet (PRD §17 is framework-only) — every
 * `resolve()` call today returns `DisabledIntegrationProvider`, exactly the
 * behavior `DisabledGatewayProvider` gives payment gateways before a firm
 * configures one.
 * ─────────────────────────────────────────────────────────────────────────────
 */
class IntegrationProviderRegistry {
  private readonly factories = new Map<string, IntegrationProviderFactory>();
  private readonly metadata = new Map<string, IntegrationProviderMetadata>();

  /**
   * Registers a provider factory under a unique key. Called once, at module
   * load time, by the provider's OWN file (e.g. `providers/tally.provider.ts`
   * would call this from its bottom) — never from this registry or from any
   * business module. Throws on a duplicate key so two providers can never
   * silently shadow each other.
   */
  register(key: string, factory: IntegrationProviderFactory, metadata: IntegrationProviderMetadata): void {
    if (this.factories.has(key)) {
      throw new Error(`Integration provider "${key}" is already registered`);
    }
    this.factories.set(key, factory);
    this.metadata.set(key, metadata);
  }

  isRegistered(key: string): boolean {
    return this.factories.has(key);
  }

  listKeys(): string[] {
    return Array.from(this.factories.keys());
  }

  /** Metadata snapshot without constructing a provider instance — used by `syncProviderCatalog()`. */
  getMetadata(key: string): IntegrationProviderMetadata | undefined {
    return this.metadata.get(key);
  }

  /**
   * Resolves the concrete provider for one connection's context. Never
   * returns anything but a real `IntegrationProvider` — an unregistered key
   * (every key today) resolves to `DisabledIntegrationProvider`, so callers
   * only ever check `isConfigured`, exactly like `resolvePaymentGatewayProvider`.
   */
  resolve(key: string, context: IntegrationProviderContext): IntegrationProvider {
    const factory = this.factories.get(key);
    if (!factory || !context.credentials) {
      return new DisabledIntegrationProvider(key);
    }
    return factory(context);
  }
}

export const integrationProviderRegistry = new IntegrationProviderRegistry();
