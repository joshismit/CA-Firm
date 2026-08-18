import { PrismaClient, Prisma, IntegrationWebhookLog, IntegrationWebhookStatus } from '@prisma/client';

export interface CreateIntegrationWebhookLogInput {
  tenantId: string | null;
  connectionId: string | null;
  providerKey: string;
  externalEventId: string | null;
  status: IntegrationWebhookStatus;
  signatureValid: boolean | null;
  headers: Prisma.InputJsonValue;
  payload: Prisma.InputJsonValue | undefined;
}

/**
 * Deliberately does NOT extend `BaseRepository` — `tenantId` is nullable here
 * (a webhook is logged BEFORE the tenant is resolved, see the model's header
 * comment in `schema.prisma`), so `BaseRepository.applyFilters()`'s
 * "tenantId is required unless ignoreTenant" rule doesn't fit this table's
 * one real access pattern: log first, resolve/update after. Same reasoning
 * as `PaymentGatewaySettingsRepository`.
 */
export class IntegrationWebhookLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateIntegrationWebhookLogInput): Promise<IntegrationWebhookLog> {
    return this.prisma.integrationWebhookLog.create({ data: input });
  }

  async findById(id: string): Promise<IntegrationWebhookLog | null> {
    return this.prisma.integrationWebhookLog.findUnique({ where: { id } });
  }

  /** Idempotency check (PRD §17 Step 7) — a provider's own event id is unique per provider. */
  async findByExternalEventId(providerKey: string, externalEventId: string): Promise<IntegrationWebhookLog | null> {
    return this.prisma.integrationWebhookLog.findUnique({
      where: { uq_integration_webhook_logs_provider_event: { providerKey, externalEventId } },
    });
  }

  async markProcessed(id: string): Promise<IntegrationWebhookLog> {
    return this.prisma.integrationWebhookLog.update({
      where: { id },
      data: { status: IntegrationWebhookStatus.PROCESSED, processedAt: new Date() },
    });
  }

  async markFailed(id: string, errorMessage: string): Promise<IntegrationWebhookLog> {
    return this.prisma.integrationWebhookLog.update({
      where: { id },
      data: {
        status: IntegrationWebhookStatus.FAILED,
        errorMessage,
        retryCount: { increment: 1 },
      },
    });
  }

  async findByTenant(tenantId: string, query: { page: number; limit: number }): Promise<{ data: IntegrationWebhookLog[]; total: number }> {
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await Promise.all([
      this.prisma.integrationWebhookLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
      this.prisma.integrationWebhookLog.count({ where: { tenantId } }),
    ]);
    return { data, total };
  }
}
