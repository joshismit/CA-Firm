import { PrismaClient, Prisma, IntegrationConnection, IntegrationConnectionStatus } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';

export class IntegrationConnectionRepository extends BaseRepository<Prisma.IntegrationConnectionDelegate, IntegrationConnection> {
  constructor(prisma: PrismaClient) {
    super(prisma.integrationConnection, prisma);
  }

  async listByTenant(tenantId: string, providerKey?: string): Promise<IntegrationConnection[]> {
    return this.findMany(providerKey ? { providerKey } : {}, { tenantId }, undefined, { createdAt: 'desc' });
  }

  /**
   * System-context lookup that bypasses tenant scoping — used only by the
   * generic webhook controller/worker (`IntegrationWebhookService`,
   * `workers/integration-webhook.worker.ts`), which receive a `connectionId`
   * from the inbound webhook URL itself with no authenticated tenant on the
   * request, exactly the situation `PaymentGatewayLinkRepository.findByProviderPaymentId()`
   * solves for the payment-gateway webhook. Every write that follows re-derives
   * `tenantId` from the row this returns and scopes through THAT — no
   * cross-tenant data is ever read or written as a result.
   */
  async findByIdIgnoreTenant(id: string): Promise<IntegrationConnection | null> {
    return this.findById(id, { ignoreTenant: true });
  }

  /**
   * The scheduled-sync scan's ONE query (`workers/integration-sync.worker.ts`'s
   * `scanIntegrationSyncJob`) — a system/cron job with no single tenant to scope
   * to, so it deliberately scans across every tenant via `ignoreTenant: true`,
   * same reasoning as `TaskReminderRepository`'s daily scan queries.
   */
  async findDueForScheduledSync(now: Date, limit = 200): Promise<IntegrationConnection[]> {
    return this.prisma.integrationConnection.findMany({
      where: {
        deletedAt: null,
        status: IntegrationConnectionStatus.CONNECTED,
        autoSyncEnabled: true,
        nextSyncAt: { lte: now },
      },
      take: limit,
      orderBy: { nextSyncAt: 'asc' },
    });
  }

  async updateAfterSync(
    id: string,
    data: { lastSyncAt: Date; nextSyncAt: Date | null; status?: IntegrationConnectionStatus; lastError?: string | null },
    options: RepositoryOptions,
  ): Promise<IntegrationConnection> {
    return this.update(id, data, options);
  }
}
