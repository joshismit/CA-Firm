import { IntegrationCategory, IntegrationSyncDirection } from '@prisma/client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Integration Provider Interface (PRD §17 — Future Integrations framework)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Mirrors `modules/notifications/providers/notification-provider.interface.ts`
 * and `modules/client-billing/providers/payment-gateway-provider.interface.ts`'s
 * shape exactly (`isConfigured`, `getCapabilities()`, a `health()`-style check,
 * result objects instead of thrown exceptions for expected failures) — same
 * per-tenant instantiation model as `PaymentGatewayProvider`: a concrete
 * provider is built fresh from ONE `IntegrationConnection`'s own decrypted
 * credentials, never a platform-wide singleton.
 *
 * No business module (CRM/Documents/Billing/Tasks/Notifications/...) and no
 * other file in `modules/integrations` outside `providers/` ever imports a
 * concrete provider class or a vendor SDK directly — everything goes through
 * this interface plus `IntegrationProviderRegistry` (see `integration-provider.registry.ts`).
 * Adding Tally/Zoho/QuickBooks/Google Drive/Gmail/DocuSign/... later is:
 *   1. a new class implementing `IntegrationProvider` in `providers/`, and
 *   2. one `integrationProviderRegistry.register(key, factory)` call,
 * with zero changes to `IntegrationConnectionService`, the sync engine, the
 * webhook controller, or any business module.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Whatever this provider's `connect()` needs — shape is entirely provider-defined; the
 *  framework only ever treats it as an opaque bag it encrypts/decrypts, never inspects. */
export type IntegrationCredentials = Record<string, unknown>;

export interface IntegrationConnectParams {
  tenantId: string;
  credentials: IntegrationCredentials;
  /** Non-secret, provider-specific settings — mirrors `IntegrationConnection.config`. */
  config?: Record<string, unknown>;
}

export interface IntegrationConnectResult {
  success: boolean;
  /** The provider's own identifier for the connected account, when it has one (e.g. a Tally company GUID). */
  externalAccountId?: string;
  /** OAuth access/refresh tokens (or any credential the provider wants persisted going forward) —
   *  merged into `IntegrationConnection.encryptedCredentials` by the caller, this provider never
   *  writes to the database itself. */
  credentials?: IntegrationCredentials;
  /** Present only for OAuth-style providers whose access token expires. */
  expiresAt?: Date;
  /** Non-secret account metadata stored as-is in `IntegrationConnection.metadata`. */
  metadata?: Record<string, unknown>;
  /** Present only when `success` is false — never thrown, mirroring `PaymentGatewayProvider`'s `RefundResult.error`. */
  error?: string;
}

export interface IntegrationDisconnectResult {
  success: boolean;
  error?: string;
}

export interface IntegrationTokenRefreshResult {
  success: boolean;
  credentials?: IntegrationCredentials;
  expiresAt?: Date;
  error?: string;
}

/** Backs `GET /integrations/health`, mirrors `PaymentGatewayHealth`/`NotificationProviderHealth`. */
export interface IntegrationHealth {
  status: 'up' | 'down' | 'unconfigured';
  checkedAt: string;
  latencyMs?: number;
  detail?: string;
}

export interface IntegrationSyncParams {
  direction: IntegrationSyncDirection;
  isDryRun: boolean;
  /** Incremental sync watermark — the provider decides what "changed since" means for its own data. */
  since?: Date;
  /** Opaque pagination cursor, provider-defined, echoed back in `IntegrationSyncResult.cursor` for the next page. */
  cursor?: string;
}

export interface IntegrationSyncResult {
  success: boolean;
  itemsProcessed: number;
  itemsSucceeded: number;
  itemsFailed: number;
  /** PRD §17 Step 6 "Conflict detection" — count only; the framework never resolves a conflict itself. */
  conflicts?: number;
  /** Set when more pages remain — the sync engine re-invokes `sync()` with this as the next `cursor`. */
  cursor?: string;
  /** Opaque, provider-defined — stored as-is in `IntegrationSync.resultSummary`. */
  summary?: Record<string, unknown>;
  /** Present only when `success` is false at the batch level (a per-item failure is instead reflected in `itemsFailed`). */
  error?: string;
}

export interface IntegrationValidateResult {
  valid: boolean;
  reason?: string;
}

/** Every provider's fixed, non-network-dependent shape — does not vary by tenant/connection,
 *  mirrors `PaymentGatewayCapabilities`/`NotificationProviderCapabilities`. */
export interface IntegrationCapabilities {
  category: IntegrationCategory;
  supportsSync: boolean;
  supportsWebhooks: boolean;
  supportsOAuth: boolean;
  supportedSyncDirections: IntegrationSyncDirection[];
}

export interface IntegrationWebhookEvent {
  /** Exact raw bytes of the inbound request body — required for HMAC-style signature
   *  verification, which must run over the raw payload, not a re-serialized parsed object
   *  (same reasoning as `PaymentGatewayProvider.verifyWebhookSignature`). */
  rawBody: Buffer;
  headers: Record<string, string | undefined>;
  signature?: string;
}

export interface IntegrationWebhookResult {
  /** Signature verification outcome — `false` short-circuits the caller before any processing. */
  valid: boolean;
  /** The provider's own event/delivery id, when its payload has one — used for cross-provider idempotency. */
  externalEventId?: string;
  /** Some verified webhook deliveries are pure pings/no-ops the provider still wants acknowledged
   *  but never turned into a sync run — `false` here skips enqueueing a sync without rejecting the call. */
  shouldProcess: boolean;
  /** Parsed payload, stored as-is in `IntegrationWebhookLog.payload`. */
  payload?: Record<string, unknown>;
  error?: string;
}

export interface IntegrationProvider {
  /** Registry slug — matches this provider's `IntegrationProvider` (Prisma catalog) row's `key`. */
  readonly key: string;
  /** False when this connection hasn't got the credentials this provider needs — every method
   *  below short-circuits rather than attempting a network call, mirroring `PaymentGatewayProvider.isConfigured`. */
  readonly isConfigured: boolean;

  connect(params: IntegrationConnectParams): Promise<IntegrationConnectResult>;
  disconnect(): Promise<IntegrationDisconnectResult>;
  /** No-op (`{ success: true }`) for providers whose auth never expires (e.g. a static API key). */
  refreshToken(): Promise<IntegrationTokenRefreshResult>;
  health(): Promise<IntegrationHealth>;
  sync(params: IntegrationSyncParams): Promise<IntegrationSyncResult>;
  /** Configuration-only check — never makes a network call, mirrors `NotificationProvider.validate()`. */
  validate(): Promise<IntegrationValidateResult>;
  /** Cheap, synchronous capability probe (e.g. `supports('supportsWebhooks')`) — equivalent to
   *  `getCapabilities()[capability]`, provided directly so callers don't have to destructure. */
  supports(capability: keyof IntegrationCapabilities): boolean;
  getCapabilities(): IntegrationCapabilities;
  /** Verifies + parses an inbound webhook call for THIS connection's own secret — never a
   *  platform-wide secret, mirrors `PaymentGatewayProvider.verifyWebhookSignature`'s per-tenant scoping. */
  webhook(event: IntegrationWebhookEvent): Promise<IntegrationWebhookResult>;
}
