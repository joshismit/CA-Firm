import { randomUUID } from 'crypto';
import {
  Prisma,
  AuditEventType,
  IntegrationConnection,
  IntegrationConnectionStatus,
  IntegrationSync,
  IntegrationSyncDirection,
  IntegrationSyncStatus,
  IntegrationSyncTrigger,
  IntegrationJobType,
} from '@prisma/client';
import { prisma } from '@config/database';
import { integrationEncryptionConfig } from '@config/integration-encryption';
import { integrationSyncQueue } from '@config/queue';
import { AUDIT } from '@shared/constants';
import { ErrorCode } from '@shared/enums';
import { ConflictError, NotFoundError, ServiceUnavailableError } from '@shared/errors';
import { CryptoUtils } from '@shared/utils';
import { AuditLogRecorder } from '@modules/audit';
import { IntegrationConnectionRepository, IntegrationSyncRepository, IntegrationJobRepository } from '../repository';
import { integrationProviderRegistry, IntegrationCredentials } from '../providers';

export interface TriggerManualSyncParams {
  tenantId: string;
  connectionId: string;
  userId: string;
  direction?: IntegrationSyncDirection;
  isDryRun?: boolean;
}

export interface TriggerWebhookSyncParams {
  tenantId: string;
  connectionId: string;
  webhookLogId: string;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Integration Sync Engine (PRD §17 Step 6 — generic sync framework)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Plain class with explicit constructor DI, NOT `BaseService` — mirrors
 * `TaskReminderService`'s exact reasoning: `executeSync()` runs inside a
 * BullMQ worker (`workers/integration-sync.worker.ts`), which has no
 * `Request` to derive `tenantId`/`userId` from, and the scheduled-scan path
 * fans out across every tenant in one pass. The `trigger*` methods (called
 * from request-scoped services/controllers) accept an explicit `tenantId`
 * instead.
 *
 * No provider-specific logic anywhere in this file — `success`, backoff, and
 * retries are entirely BullMQ's (`integrationSyncQueue`'s `attempts`/`backoff`,
 * see `config/queue.ts`); this class only ever calls the generic
 * `IntegrationProvider.sync()` contract and interprets its generic result
 * shape (`itemsSucceeded`/`itemsFailed`/`conflicts` → SUCCESS/PARTIAL_SUCCESS/FAILED).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class IntegrationSyncEngine {
  constructor(
    private readonly connectionRepository: IntegrationConnectionRepository = new IntegrationConnectionRepository(prisma),
    private readonly syncRepository: IntegrationSyncRepository = new IntegrationSyncRepository(prisma),
    private readonly jobRepository: IntegrationJobRepository = new IntegrationJobRepository(prisma),
    private readonly auditLogRecorder: AuditLogRecorder = new AuditLogRecorder(),
  ) {}

  /** `POST /integrations/sync` — a human explicitly asked for this, so no idempotency
   *  dedupe beyond the overlap guard below (a genuine double-click is expected to just
   *  hit the 409, not be silently absorbed). */
  async triggerManual(params: TriggerManualSyncParams): Promise<IntegrationSync> {
    const options = { tenantId: params.tenantId };
    const connection = await this.connectionRepository.findById(params.connectionId, options);
    if (!connection) throw new NotFoundError('Integration connection', ErrorCode.INTEGRATION_CONNECTION_NOT_FOUND);

    await this.assertNoActiveRun(params.connectionId, options);

    const sync = await this.createSync({
      tenantId: params.tenantId,
      connection,
      trigger: IntegrationSyncTrigger.MANUAL,
      direction: params.direction ?? connection.syncDirection,
      isDryRun: params.isDryRun ?? false,
      idempotencyKey: `${params.connectionId}:MANUAL:${randomUUID()}`,
      triggeredBy: params.userId,
    });

    await this.auditLogRecorder.record({
      tenantId: params.tenantId,
      actorId: params.userId,
      eventType: AuditEventType.INTEGRATION_SYNC_TRIGGERED,
      description: `Triggered a manual sync for integration connection "${connection.label ?? connection.providerKey}"`,
      targetType: 'IntegrationConnection',
      targetId: connection.id,
    });

    return sync;
  }

  /**
   * Called once per due connection by `workers/integration-sync.worker.ts`'s
   * scheduled scan. Deterministic `idempotencyKey` (connection + a fixed-width
   * time bucket) means an overlapping scan run — or a retried scan — hits the
   * DB's `@@unique` on `idempotencyKey` (P2002) instead of double-scheduling,
   * exactly `TaskReminderRepository.record()`'s own guard.
   */
  async triggerScheduled(connection: IntegrationConnection): Promise<IntegrationSync | null> {
    const options = { tenantId: connection.tenantId };
    const activeRun = await this.syncRepository.hasActiveRun(connection.id, options);
    if (activeRun) return null;

    const bucketMinutes = connection.syncFrequencyMinutes ?? 60;
    const bucket = Math.floor(Date.now() / (bucketMinutes * 60_000));

    try {
      return await this.createSync({
        tenantId: connection.tenantId,
        connection,
        trigger: IntegrationSyncTrigger.SCHEDULED,
        direction: connection.syncDirection,
        isDryRun: false,
        idempotencyKey: `${connection.id}:SCHEDULED:${bucket}`,
        triggeredBy: null,
      });
    } catch (error) {
      if (this.isDuplicateSync(error)) return null;
      throw error;
    }
  }

  /**
   * Called by `workers/integration-webhook.worker.ts` once a webhook has been
   * verified and logged. `idempotencyKey` is keyed on the `IntegrationWebhookLog`
   * row itself, so a BullMQ retry of the SAME webhook job can never enqueue a
   * second sync run for it.
   */
  async triggerWebhook(params: TriggerWebhookSyncParams): Promise<IntegrationSync | null> {
    const options = { tenantId: params.tenantId };
    const connection = await this.connectionRepository.findById(params.connectionId, options);
    if (!connection) return null;

    try {
      return await this.createSync({
        tenantId: params.tenantId,
        connection,
        trigger: IntegrationSyncTrigger.WEBHOOK,
        direction: connection.syncDirection,
        isDryRun: false,
        idempotencyKey: `${connection.id}:WEBHOOK:${params.webhookLogId}`,
        triggeredBy: null,
      });
    } catch (error) {
      if (this.isDuplicateSync(error)) return null;
      throw error;
    }
  }

  /**
   * The actual work — invoked ONLY from `workers/integration-sync.worker.ts`'s
   * job processor, never inline on a request. Resolves the provider fresh from
   * the connection's own decrypted credentials (never cached across runs, so a
   * credential rotation takes effect on the very next sync), calls the
   * generic `sync()` contract, and persists whatever it returns.
   */
  async executeSync(syncId: string): Promise<void> {
    const sync = await this.syncRepository.findByIdIgnoreTenant(syncId);
    if (!sync) throw new NotFoundError('Integration sync', ErrorCode.RESOURCE_NOT_FOUND);

    const options = { tenantId: sync.tenantId, ignoreTenant: true };
    const connection = await this.connectionRepository.findById(sync.connectionId, options);
    if (!connection) throw new NotFoundError('Integration connection', ErrorCode.INTEGRATION_CONNECTION_NOT_FOUND);

    await this.syncRepository.update(sync.id, { status: IntegrationSyncStatus.RUNNING, startedAt: new Date() }, options);

    const credentials = this.decryptCredentials(connection);
    const provider = integrationProviderRegistry.resolve(connection.providerKey, {
      connectionId: connection.id,
      tenantId: connection.tenantId,
      credentials,
      config: (connection.config as Record<string, unknown>) ?? {},
    });

    let result;
    try {
      result = await provider.sync({
        direction: sync.direction,
        isDryRun: sync.isDryRun,
        since: connection.lastSyncAt ?? undefined,
      });
    } catch (error) {
      result = {
        success: false,
        itemsProcessed: 0,
        itemsSucceeded: 0,
        itemsFailed: 0,
        error: error instanceof Error ? error.message : 'Unknown sync error',
      };
    }

    const status = this.resolveStatus(result);
    const now = new Date();

    await this.syncRepository.update(
      sync.id,
      {
        status,
        completedAt: now,
        itemsProcessed: result.itemsProcessed,
        itemsSucceeded: result.itemsSucceeded,
        itemsFailed: result.itemsFailed,
        conflictCount: result.conflicts ?? 0,
        resultSummary: (result.summary as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        errorMessage: result.error ?? null,
      },
      options,
    );

    const nextSyncAt =
      connection.autoSyncEnabled && connection.syncFrequencyMinutes
        ? new Date(now.getTime() + connection.syncFrequencyMinutes * 60_000)
        : null;

    await this.connectionRepository.updateAfterSync(
      connection.id,
      {
        lastSyncAt: now,
        nextSyncAt,
        status: status === IntegrationSyncStatus.FAILED ? IntegrationConnectionStatus.ERROR : IntegrationConnectionStatus.CONNECTED,
        lastError: result.error ?? null,
      },
      options,
    );

    await this.auditLogRecorder.record({
      tenantId: connection.tenantId,
      actorId: sync.triggeredBy ?? AUDIT.SYSTEM_ACTOR_ID,
      actorName: sync.triggeredBy ? undefined : AUDIT.SYSTEM_ACTOR_NAME,
      eventType: status === IntegrationSyncStatus.FAILED ? AuditEventType.INTEGRATION_SYNC_FAILED : AuditEventType.INTEGRATION_SYNC_COMPLETED,
      description: `Integration sync ${status.toLowerCase()} for connection "${connection.label ?? connection.providerKey}" (${result.itemsSucceeded}/${result.itemsProcessed} succeeded)`,
      targetType: 'IntegrationConnection',
      targetId: connection.id,
      metadata: { syncId: sync.id, trigger: sync.trigger } as Prisma.InputJsonValue,
    });
  }

  private async createSync(input: {
    tenantId: string;
    connection: IntegrationConnection;
    trigger: IntegrationSyncTrigger;
    direction: IntegrationSyncDirection;
    isDryRun: boolean;
    idempotencyKey: string;
    triggeredBy: string | null;
  }): Promise<IntegrationSync> {
    const sync = await this.syncRepository.create(
      {
        connectionId: input.connection.id,
        direction: input.direction,
        trigger: input.trigger,
        status: IntegrationSyncStatus.PENDING,
        idempotencyKey: input.idempotencyKey,
        isDryRun: input.isDryRun,
        triggeredBy: input.triggeredBy,
      },
      { tenantId: input.tenantId },
    );

    await this.jobRepository.create({
      tenantId: input.tenantId,
      connectionId: input.connection.id,
      jobType: IntegrationJobType.SYNC,
      queueJobId: sync.id,
      relatedSyncId: sync.id,
    });

    await integrationSyncQueue.add('sync', { syncId: sync.id }, { jobId: sync.id });

    return sync;
  }

  private async assertNoActiveRun(connectionId: string, options: { tenantId: string }): Promise<void> {
    const hasActive = await this.syncRepository.hasActiveRun(connectionId, options);
    if (hasActive) {
      throw new ConflictError('A sync is already in progress for this connection', ErrorCode.INTEGRATION_SYNC_IN_PROGRESS);
    }
  }

  private decryptCredentials(connection: IntegrationConnection): IntegrationCredentials | null {
    if (!connection.encryptedCredentials) return null;
    if (!integrationEncryptionConfig.isConfigured) {
      throw new ServiceUnavailableError(
        'Integration credential storage is not configured on this server yet',
        ErrorCode.DEPENDENCY_UNAVAILABLE,
      );
    }
    const decrypted = CryptoUtils.decryptSecret(connection.encryptedCredentials, integrationEncryptionConfig.key as string);
    return JSON.parse(decrypted) as IntegrationCredentials;
  }

  private resolveStatus(result: { success: boolean; itemsProcessed: number; itemsSucceeded: number; itemsFailed: number }): IntegrationSyncStatus {
    if (!result.success && result.itemsProcessed === 0) return IntegrationSyncStatus.FAILED;
    if (result.itemsFailed > 0 && result.itemsSucceeded > 0) return IntegrationSyncStatus.PARTIAL_SUCCESS;
    if (result.itemsFailed > 0 && result.itemsSucceeded === 0) return IntegrationSyncStatus.FAILED;
    return IntegrationSyncStatus.SUCCESS;
  }

  private isDuplicateSync(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
