import { Prisma, AuditEventType, IntegrationJobType, IntegrationWebhookLog, IntegrationWebhookStatus } from '@prisma/client';
import { prisma } from '@config/database';
import { integrationEncryptionConfig } from '@config/integration-encryption';
import { integrationWebhookQueue } from '@config/queue';
import { AUDIT } from '@shared/constants';
import { CryptoUtils } from '@shared/utils';
import { AuditLogRecorder } from '@modules/audit';
import {
  IntegrationConnectionRepository,
  IntegrationWebhookLogRepository,
  IntegrationJobRepository,
} from '../repository';
import { integrationProviderRegistry, IntegrationCredentials } from '../providers';

export interface IncomingIntegrationWebhook {
  providerKey: string;
  connectionId: string;
  rawBody: Buffer;
  headers: Record<string, string | undefined>;
  signature?: string;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Integration Webhook Service (PRD §17 Step 7 — the generic webhook framework)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Responsibilities, in order, exactly matching PRD §17's list: provider
 * lookup → signature verification → tenant resolution → idempotency → audit
 * → queue dispatch. Retry + dead-letter handling live in
 * `workers/integration-webhook.worker.ts` (BullMQ `attempts`/`backoff` on
 * `integrationWebhookQueue`, see `config/queue.ts`) — this service only ever
 * logs and enqueues, it never itself calls the sync engine.
 *
 * Tenant resolution here is deliberately simpler than
 * `PaymentGatewayWebhookService`'s "look the tenant up from the payload"
 * trick: the inbound URL itself (`POST /integrations/webhook/:provider/:connectionId`)
 * carries the connection id, so the tenant is resolved by one direct lookup,
 * not by parsing provider-specific payload fields — keeping this file free
 * of any provider-specific knowledge.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class IntegrationWebhookService {
  constructor(
    private readonly connectionRepository: IntegrationConnectionRepository = new IntegrationConnectionRepository(prisma),
    private readonly webhookLogRepository: IntegrationWebhookLogRepository = new IntegrationWebhookLogRepository(prisma),
    private readonly jobRepository: IntegrationJobRepository = new IntegrationJobRepository(prisma),
    private readonly auditLogRecorder: AuditLogRecorder = new AuditLogRecorder(),
  ) {}

  async handleWebhook(event: IncomingIntegrationWebhook): Promise<IntegrationWebhookLog> {
    const headers = event.headers as unknown as Prisma.InputJsonValue;

    // 1. Provider/connection lookup — `ignoreTenant` because there is no authenticated
    //    tenant on this request at all, only whatever `:connectionId` the URL carries.
    const connection = await this.connectionRepository.findByIdIgnoreTenant(event.connectionId);
    if (!connection || connection.providerKey !== event.providerKey) {
      return this.webhookLogRepository.create({
        tenantId: null,
        connectionId: null,
        providerKey: event.providerKey,
        externalEventId: null,
        status: IntegrationWebhookStatus.REJECTED,
        signatureValid: false,
        headers,
        payload: undefined,
      });
    }

    // 2. Signature verification — delegated to the connection's own provider, since only
    //    the provider knows its signature scheme; never a platform-wide secret.
    const credentials = this.tryDecrypt(connection.encryptedCredentials);
    const provider = integrationProviderRegistry.resolve(event.providerKey, {
      connectionId: connection.id,
      tenantId: connection.tenantId,
      credentials,
      config: (connection.config as Record<string, unknown>) ?? {},
    });
    const result = await provider.webhook({ rawBody: event.rawBody, headers: event.headers, signature: event.signature });

    // 3. Tenant already resolved above (`connection.tenantId`). 4. Idempotency: a duplicate
    //    `externalEventId` for this provider hits `IntegrationWebhookLog`'s own `@@unique` —
    //    caught below and treated as an already-logged replay, not an error.
    let log: IntegrationWebhookLog;
    try {
      log = await this.webhookLogRepository.create({
        tenantId: connection.tenantId,
        connectionId: connection.id,
        providerKey: event.providerKey,
        externalEventId: result.externalEventId ?? null,
        status: result.valid ? IntegrationWebhookStatus.VERIFIED : IntegrationWebhookStatus.REJECTED,
        signatureValid: result.valid,
        headers,
        payload: result.payload as Prisma.InputJsonValue | undefined,
      });
    } catch (error) {
      if (this.isDuplicateEvent(error) && result.externalEventId) {
        const existingLog = await this.webhookLogRepository.findByExternalEventId(event.providerKey, result.externalEventId);
        if (existingLog) return existingLog;
      }
      throw error;
    }

    if (!result.valid) return log;

    // 5. Audit — system actor, mirrors `PaymentGatewayWebhookService`'s use of `AUDIT.SYSTEM_ACTOR_ID`.
    await this.auditLogRecorder.record({
      tenantId: connection.tenantId,
      actorId: AUDIT.SYSTEM_ACTOR_ID,
      actorName: AUDIT.SYSTEM_ACTOR_NAME,
      eventType: AuditEventType.INTEGRATION_WEBHOOK_RECEIVED,
      description: `Received a verified "${event.providerKey}" webhook for connection "${connection.label ?? connection.providerKey}"`,
      targetType: 'IntegrationConnection',
      targetId: connection.id,
      metadata: { webhookLogId: log.id, externalEventId: result.externalEventId ?? null } as Prisma.InputJsonValue,
    });

    // 6. Queue dispatch — never processed inline; a slow/failing sync must never hold the
    //    webhook response open (see `workers/integration-webhook.worker.ts`).
    if (result.shouldProcess) {
      await this.jobRepository.create({
        tenantId: connection.tenantId,
        connectionId: connection.id,
        jobType: IntegrationJobType.WEBHOOK_PROCESSING,
        queueJobId: log.id,
        relatedWebhookLogId: log.id,
      });
      await integrationWebhookQueue.add('webhook', { webhookLogId: log.id }, { jobId: log.id });
    }

    return log;
  }

  private tryDecrypt(encrypted: string | null): IntegrationCredentials | null {
    if (!encrypted || !integrationEncryptionConfig.isConfigured) return null;
    try {
      const decrypted = CryptoUtils.decryptSecret(encrypted, integrationEncryptionConfig.key as string);
      return JSON.parse(decrypted) as IntegrationCredentials;
    } catch {
      return null;
    }
  }

  private isDuplicateEvent(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
