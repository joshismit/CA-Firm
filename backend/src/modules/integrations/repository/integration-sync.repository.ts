import { PrismaClient, Prisma, IntegrationSync, IntegrationSyncStatus } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';
import { PaginationQuery, PaginationMeta } from '@shared/types';

/**
 * `IntegrationSync` has no `deletedAt` column — it's a permanent run-history
 * ledger, same reasoning as `TaskReminderRepository`'s ("a sent-reminder
 * record is permanent, same reasoning as `AuditLogRepository`"). Rather than
 * passing `ignoreSoftDelete: true` at every call site, `applyFilters()` is
 * overridden once here so every inherited `BaseRepository` method (find/update/
 * exists/paginate/...) is automatically safe against this model's shape.
 */
export class IntegrationSyncRepository extends BaseRepository<Prisma.IntegrationSyncDelegate, IntegrationSync> {
  constructor(prisma: PrismaClient) {
    super(prisma.integrationSync, prisma);
  }

  protected applyFilters(
    where: Record<string, unknown> = {},
    options: RepositoryOptions = {},
  ): Record<string, unknown> {
    return super.applyFilters(where, { ...options, ignoreSoftDelete: true });
  }

  async findHistory(
    connectionId: string | undefined,
    query: PaginationQuery,
    options: RepositoryOptions,
  ): Promise<{ data: IntegrationSync[]; meta: PaginationMeta }> {
    return this.paginate(query, connectionId ? { connectionId } : {}, options);
  }

  /**
   * Whether this connection already has a run that hasn't reached a terminal
   * state — the sync engine's overlap guard (PRD §17 Step 6 "Idempotency"),
   * checked before enqueueing a new run so a slow/stuck sync can never be
   * double-triggered by a second manual click or an overlapping scheduled scan.
   */
  async hasActiveRun(connectionId: string, options: RepositoryOptions): Promise<boolean> {
    return this.exists(
      { connectionId, status: { in: [IntegrationSyncStatus.PENDING, IntegrationSyncStatus.RUNNING] } },
      options,
    );
  }

  /**
   * System-context lookup for the worker (`workers/integration-sync.worker.ts`)
   * — a BullMQ job carries `tenantId` in its own payload already, so this skips
   * re-deriving it through a request-scoped `BaseService`, same reasoning as
   * `IntegrationConnectionRepository.findByIdIgnoreTenant`.
   */
  async findByIdIgnoreTenant(id: string): Promise<IntegrationSync | null> {
    return this.findById(id, { ignoreTenant: true });
  }
}
