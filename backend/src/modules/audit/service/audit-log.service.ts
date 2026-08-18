import { Request } from 'express';
import { AuditLog } from '@prisma/client';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { PaginationMeta } from '@shared/types';
import { AuditLogRepository } from '../repository/audit-log.repository';
import { ListAuditLogsQueryDto } from '../dto/audit.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Audit Log Service (read side)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Business logic for reading `AuditLog` entries. No HTTP concerns — the
 * controller passes plain values in and gets domain entities back, exactly
 * like every other module's service. This class only ever reads — writes go
 * through `AuditLogRecorder` (`service/audit-log.recorder.ts`), called from
 * the *other* modules whose actions are being recorded, not from here.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class AuditLogService extends BaseService {
  constructor(
    req: Request,
    private readonly repository: AuditLogRepository = new AuditLogRepository(prisma),
  ) {
    super(req);
  }

  async listAuditLogs(query: ListAuditLogsQueryDto): Promise<{ data: AuditLog[]; meta: PaginationMeta }> {
    return this.repository.search(
      {
        search: query.search,
        eventType: query.eventType,
        actorId: query.actorId,
        targetType: query.targetType,
        from: query.from,
        to: query.to,
      },
      { page: query.page, limit: query.limit, sortBy: query.sortBy, sortOrder: query.sortOrder },
      { tenantId: this.tenantId },
    );
  }

  async getAuditLogById(id: string): Promise<AuditLog> {
    const entry = await this.repository.findByIdScoped(id, { tenantId: this.tenantId });
    this.validateExists(entry, 'Audit log entry');
    return entry;
  }
}
