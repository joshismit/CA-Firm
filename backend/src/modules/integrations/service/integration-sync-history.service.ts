import { Request } from 'express';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { ForbiddenError, NotFoundError } from '@shared/errors';
import { MESSAGES } from '@shared/constants';
import { ErrorCode } from '@shared/enums';
import { PaginationQuery, PaginationMeta } from '@shared/types';
import { IntegrationConnectionRepository, IntegrationSyncRepository } from '../repository';
import { IntegrationSyncMapper } from '../mapper';
import { IntegrationSyncResponseDto } from '../dto';
import { IntegrationSyncEngine, TriggerManualSyncParams } from './integration-sync-engine.service';

/** `GET /integrations/sync-history` + `POST /integrations/sync` — a thin, request-scoped
 *  wrapper over `IntegrationSyncRepository`/`IntegrationSyncEngine` so the controller never
 *  touches Prisma or the engine directly, mirroring `PaymentLinkController` → `PaymentLinkService`. */
export class IntegrationSyncHistoryService extends BaseService {
  constructor(
    req: Request,
    private readonly syncRepository: IntegrationSyncRepository = new IntegrationSyncRepository(prisma),
    private readonly connectionRepository: IntegrationConnectionRepository = new IntegrationConnectionRepository(prisma),
    private readonly syncEngine: IntegrationSyncEngine = new IntegrationSyncEngine(),
  ) {
    super(req);
  }

  async triggerSync(params: Omit<TriggerManualSyncParams, 'tenantId' | 'userId'>): Promise<IntegrationSyncResponseDto> {
    const tenantId = this.requireTenantId();
    const userId = this.requireUserId();
    const sync = await this.syncEngine.triggerManual({ ...params, tenantId, userId });
    return IntegrationSyncMapper.toResponseDto(sync);
  }

  async getHistory(connectionId: string | undefined, query: PaginationQuery): Promise<{ data: IntegrationSyncResponseDto[]; meta: PaginationMeta }> {
    const tenantId = this.requireTenantId();

    if (connectionId) {
      const connection = await this.connectionRepository.findById(connectionId, { tenantId });
      if (!connection) throw new NotFoundError('Integration connection', ErrorCode.INTEGRATION_CONNECTION_NOT_FOUND);
    }

    const { data, meta } = await this.syncRepository.findHistory(connectionId, query, { tenantId });
    return { data: data.map(IntegrationSyncMapper.toResponseDto), meta };
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
