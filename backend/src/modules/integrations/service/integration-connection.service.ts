import { Request } from 'express';
import { AuditEventType, IntegrationConnectionStatus, Prisma } from '@prisma/client';
import { prisma } from '@config/database';
import { integrationEncryptionConfig } from '@config/integration-encryption';
import { BaseService } from '@shared/base';
import { ForbiddenError, NotFoundError, ServiceUnavailableError } from '@shared/errors';
import { MESSAGES } from '@shared/constants';
import { ErrorCode } from '@shared/enums';
import { CryptoUtils } from '@shared/utils';
import { AuditLogRecorder } from '@modules/audit';
import { IntegrationConnectionRepository, IntegrationProviderRepository } from '../repository';
import { IntegrationConnectionMapper } from '../mapper';
import { ConnectIntegrationDto, IntegrationConnectionResponseDto } from '../dto';
import { integrationProviderRegistry, IntegrationHealth } from '../providers';
import { DisabledIntegrationProvider } from '../providers/disabled-integration.provider';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Integration Connection Service (PRD §17 — the `IntegrationService` facade
 * business modules and controllers talk to for connect/disconnect/list/health)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Same shape as `PaymentGatewaySettingsService`: encrypts/decrypts credentials
 * at this layer only, never forwards the plaintext beyond this method call,
 * and every provider-specific behavior is reached exclusively through
 * `integrationProviderRegistry.resolve()` — this file never imports a
 * concrete provider class or branches on `providerKey`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class IntegrationConnectionService extends BaseService {
  constructor(
    req: Request,
    private readonly connectionRepository: IntegrationConnectionRepository = new IntegrationConnectionRepository(prisma),
    private readonly providerRepository: IntegrationProviderRepository = new IntegrationProviderRepository(prisma),
    private readonly auditLogRecorder: AuditLogRecorder = new AuditLogRecorder(),
  ) {
    super(req);
  }

  async listConnections(providerKey?: string): Promise<IntegrationConnectionResponseDto[]> {
    const tenantId = this.requireTenantId();
    const connections = await this.connectionRepository.listByTenant(tenantId, providerKey);
    const providers = await this.providerRepository.findAll();
    const nameByKey = new Map(providers.map((provider) => [provider.key, provider.name]));

    return connections.map((connection) =>
      IntegrationConnectionMapper.toResponseDto(connection, nameByKey.get(connection.providerKey) ?? connection.providerKey),
    );
  }

  async connect(dto: ConnectIntegrationDto): Promise<IntegrationConnectionResponseDto> {
    const tenantId = this.requireTenantId();
    const userId = this.requireUserId();

    const provider = await this.providerRepository.findByKey(dto.providerKey);
    if (!provider) {
      throw new NotFoundError('Integration provider', ErrorCode.INTEGRATION_PROVIDER_NOT_FOUND);
    }

    if (!integrationEncryptionConfig.isConfigured) {
      throw new ServiceUnavailableError(
        'Integration credential storage is not configured on this server yet',
        ErrorCode.DEPENDENCY_UNAVAILABLE,
      );
    }
    const encryptionKey = integrationEncryptionConfig.key as string;
    const encryptedCredentials = CryptoUtils.encryptSecret(JSON.stringify(dto.credentials), encryptionKey);

    const isUpdate = Boolean(dto.connectionId);
    let existing = null;
    if (dto.connectionId) {
      existing = await this.connectionRepository.findById(dto.connectionId, { tenantId });
      if (!existing || existing.providerKey !== dto.providerKey) {
        throw new NotFoundError('Integration connection', ErrorCode.INTEGRATION_CONNECTION_NOT_FOUND);
      }
    }

    // The provider's own `connect()` runs BEFORE we persist anything, so a rejected
    // connect attempt (bad credentials) never leaves a half-written row behind.
    const resolved = integrationProviderRegistry.resolve(dto.providerKey, {
      connectionId: existing?.id ?? 'pending',
      tenantId,
      credentials: dto.credentials,
      config: dto.config ?? {},
    });
    // No real provider is registered for ANY key yet (PRD §17 ships the framework only) — every
    // `resolve()` call returns `DisabledIntegrationProvider`, whose own `connect()` always throws
    // (see its header comment). The framework still needs to let a firm admin STORE credentials
    // ahead of a provider shipping, so this is the one place that case is treated as "stored, but
    // unverified" rather than a hard failure — reflected honestly as `PENDING`, never `CONNECTED`,
    // below. Once a real provider registers, this branch stops being taken and a genuine
    // `connect()` result decides success/failure exactly like `PaymentGatewaySettingsService`.
    const isUnverified = resolved instanceof DisabledIntegrationProvider;
    const connectResult = isUnverified
      ? { success: true as const, metadata: undefined, expiresAt: undefined, credentials: undefined }
      : await resolved.connect({ tenantId, credentials: dto.credentials, config: dto.config });

    if (!connectResult.success) {
      throw new ServiceUnavailableError(connectResult.error ?? 'Failed to connect to the integration provider', ErrorCode.DEPENDENCY_UNAVAILABLE);
    }

    const finalCredentials = connectResult.credentials
      ? CryptoUtils.encryptSecret(JSON.stringify(connectResult.credentials), encryptionKey)
      : encryptedCredentials;

    const data = {
      providerKey: dto.providerKey,
      label: dto.label ?? existing?.label ?? null,
      status: isUnverified ? IntegrationConnectionStatus.PENDING : IntegrationConnectionStatus.CONNECTED,
      encryptedCredentials: finalCredentials,
      config: (dto.config ?? existing?.config ?? {}) as Prisma.InputJsonValue,
      syncDirection: dto.syncDirection ?? existing?.syncDirection ?? undefined,
      autoSyncEnabled: dto.autoSyncEnabled ?? existing?.autoSyncEnabled ?? false,
      syncFrequencyMinutes: dto.syncFrequencyMinutes ?? existing?.syncFrequencyMinutes ?? null,
      tokenExpiresAt: connectResult.expiresAt ?? null,
      metadata: (connectResult.metadata ?? existing?.metadata ?? undefined) as Prisma.InputJsonValue,
      lastError: null,
      updatedBy: userId,
    };

    const connection = isUpdate
      ? await this.connectionRepository.update(existing!.id, data, { tenantId, userId })
      : await this.connectionRepository.create({ ...data, createdBy: userId }, { tenantId, userId });

    await this.auditLogRecorder.record({
      tenantId,
      actorId: userId,
      eventType: isUpdate ? AuditEventType.INTEGRATION_CREDENTIAL_UPDATED : AuditEventType.INTEGRATION_CONNECTED,
      description: `${isUpdate ? 'Updated credentials for' : 'Connected'} integration "${provider.name}" (${dto.providerKey})`,
      targetType: 'IntegrationConnection',
      targetId: connection.id,
      ipAddress: this.req.ip ?? null,
    });

    return IntegrationConnectionMapper.toResponseDto(connection, provider.name);
  }

  async disconnect(connectionId: string): Promise<IntegrationConnectionResponseDto> {
    const tenantId = this.requireTenantId();
    const userId = this.requireUserId();

    const connection = await this.connectionRepository.findById(connectionId, { tenantId });
    this.validateExists(connection, 'Integration connection');

    const credentials = this.tryDecrypt(connection.encryptedCredentials);
    const provider = integrationProviderRegistry.resolve(connection.providerKey, {
      connectionId: connection.id,
      tenantId,
      credentials,
      config: (connection.config as Record<string, unknown>) ?? {},
    });
    await provider.disconnect();

    const updated = await this.connectionRepository.update(
      connectionId,
      { status: IntegrationConnectionStatus.DISCONNECTED, autoSyncEnabled: false, nextSyncAt: null, updatedBy: userId },
      { tenantId, userId },
    );

    await this.auditLogRecorder.record({
      tenantId,
      actorId: userId,
      eventType: AuditEventType.INTEGRATION_DISCONNECTED,
      description: `Disconnected integration connection "${connection.label ?? connection.providerKey}"`,
      targetType: 'IntegrationConnection',
      targetId: connection.id,
      ipAddress: this.req.ip ?? null,
    });

    const providerRow = await this.providerRepository.findByKey(connection.providerKey);
    return IntegrationConnectionMapper.toResponseDto(updated, providerRow?.name ?? connection.providerKey);
  }

  async getHealth(connectionId: string): Promise<IntegrationHealth & { providerKey: string }> {
    const tenantId = this.requireTenantId();
    const connection = await this.connectionRepository.findById(connectionId, { tenantId });
    this.validateExists(connection, 'Integration connection');

    const credentials = this.tryDecrypt(connection.encryptedCredentials);
    const provider = integrationProviderRegistry.resolve(connection.providerKey, {
      connectionId: connection.id,
      tenantId,
      credentials,
      config: (connection.config as Record<string, unknown>) ?? {},
    });

    const health = await provider.health();
    return { providerKey: connection.providerKey, ...health };
  }

  private tryDecrypt(encrypted: string | null): Record<string, unknown> | null {
    if (!encrypted || !integrationEncryptionConfig.isConfigured) return null;
    try {
      const decrypted = CryptoUtils.decryptSecret(encrypted, integrationEncryptionConfig.key as string);
      return JSON.parse(decrypted) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private requireTenantId(): string {
    if (!this.tenantId) throw new ForbiddenError(MESSAGES.FORBIDDEN);
    return this.tenantId;
  }

  private requireUserId(): string {
    if (!this.userId) throw new ForbiddenError(MESSAGES.FORBIDDEN);
    return this.userId;
  }
}
