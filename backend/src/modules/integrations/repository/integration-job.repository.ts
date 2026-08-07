import { PrismaClient, Prisma, IntegrationJob, IntegrationJobStatus, IntegrationJobType } from '@prisma/client';

export interface CreateIntegrationJobInput {
  tenantId: string | null;
  connectionId: string | null;
  jobType: IntegrationJobType;
  queueJobId: string | null;
  relatedSyncId?: string | null;
  relatedWebhookLogId?: string | null;
  payload?: Prisma.InputJsonValue;
  maxAttempts?: number;
  scheduledFor?: Date | null;
}

/**
 * Durable job/run history — deliberately does NOT extend `BaseRepository`
 * (`tenantId` is nullable for platform-level jobs, same reasoning as
 * `IntegrationWebhookLogRepository`). BullMQ (`config/queue.ts`) owns actual
 * job execution/retry in Redis; this table is the permanent audit trail of
 * what ran, mirroring `AuditLog`'s "system writes, never client-editable" shape.
 */
export class IntegrationJobRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateIntegrationJobInput): Promise<IntegrationJob> {
    return this.prisma.integrationJob.create({
      data: {
        tenantId: input.tenantId,
        connectionId: input.connectionId,
        jobType: input.jobType,
        queueJobId: input.queueJobId,
        relatedSyncId: input.relatedSyncId ?? null,
        relatedWebhookLogId: input.relatedWebhookLogId ?? null,
        payload: input.payload,
        maxAttempts: input.maxAttempts ?? 3,
        scheduledFor: input.scheduledFor ?? null,
        status: IntegrationJobStatus.QUEUED,
      },
    });
  }

  async findById(id: string): Promise<IntegrationJob | null> {
    return this.prisma.integrationJob.findUnique({ where: { id } });
  }

  async findByQueueJobId(queueJobId: string): Promise<IntegrationJob | null> {
    return this.prisma.integrationJob.findFirst({ where: { queueJobId } });
  }

  async markRunning(id: string): Promise<IntegrationJob> {
    return this.prisma.integrationJob.update({
      where: { id },
      data: { status: IntegrationJobStatus.RUNNING, startedAt: new Date(), attempts: { increment: 1 } },
    });
  }

  async markCompleted(id: string): Promise<IntegrationJob> {
    return this.prisma.integrationJob.update({
      where: { id },
      data: { status: IntegrationJobStatus.COMPLETED, completedAt: new Date() },
    });
  }

  /** `isFinalAttempt` moves the job straight to `DEAD_LETTER` (PRD §17 Step 7) instead of `RETRYING`
   *  — set by the worker's `failed` handler once `job.attemptsMade >= job.opts.attempts`. */
  async markFailed(id: string, lastError: string, isFinalAttempt: boolean): Promise<IntegrationJob> {
    return this.prisma.integrationJob.update({
      where: { id },
      data: {
        status: isFinalAttempt ? IntegrationJobStatus.DEAD_LETTER : IntegrationJobStatus.RETRYING,
        lastError,
        completedAt: isFinalAttempt ? new Date() : null,
      },
    });
  }
}
