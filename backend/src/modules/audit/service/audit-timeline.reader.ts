import { prisma } from '@config/database';
import { PaginationQuery, PaginationMeta } from '@shared/types';
import { AuditLogRepository } from '../repository/audit-log.repository';
import { AuditMapper } from '../mapper/audit.mapper';
import { AuditLogResponseDto } from '../dto/audit.res.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Audit Timeline Reader (read side, PRD §8.11)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The one read path other modules use to render a per-entity timeline
 * (`LeadService.getLeadTimeline`, `BusinessService.getBusinessTimeline`) —
 * mirrors `AuditLogRecorder` being the one write path every other module
 * calls to record an event. Takes an explicit `tenantId` rather than reading
 * off `BaseService`, same reasoning as `AuditLogRecorder`: the caller already
 * has it from its own request context.
 *
 * Returns finished `AuditLogResponseDto`s (mapped internally via `AuditMapper`)
 * rather than raw `AuditLog` rows, since `AuditMapper`/`AuditLogRepository` stay
 * module-internal — see `modules/audit/index.ts`'s header comment.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class AuditTimelineReader {
  constructor(private readonly repository: AuditLogRepository = new AuditLogRepository(prisma)) {}

  async getTimeline(
    targetType: string,
    targetId: string,
    tenantId: string,
    pagination: PaginationQuery,
  ): Promise<{ data: AuditLogResponseDto[]; meta: PaginationMeta }> {
    const { data, meta } = await this.repository.search(
      { targetType, targetId },
      pagination,
      { tenantId },
    );

    return { data: AuditMapper.toResponseDtoList(data), meta };
  }

  /**
   * PRD §10.9 — the Dashboard's "Recent Activity" widget, sourced from the real
   * `AuditLog` instead of the ad-hoc "recently created businesses/contacts/
   * projects/documents" merge it used to fake client-side. `filters.actorId`
   * scopes to "my activity" (PRD §10.11 — STAFF); omitted for unrestricted roles
   * (tenant-wide feed). Always sorted newest-first via `pagination.sortBy`.
   */
  async getRecentActivity(
    tenantId: string,
    filters: { actorId?: string },
    pagination: PaginationQuery,
  ): Promise<{ data: AuditLogResponseDto[]; meta: PaginationMeta }> {
    const { data, meta } = await this.repository.search(
      { actorId: filters.actorId },
      { ...pagination, sortBy: pagination.sortBy ?? 'createdAt', sortOrder: pagination.sortOrder ?? 'desc' },
      { tenantId },
    );

    return { data: AuditMapper.toResponseDtoList(data), meta };
  }
}
