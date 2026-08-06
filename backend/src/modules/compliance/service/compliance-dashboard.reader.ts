import { prisma } from '@config/database';
import { ComplianceFilingStatus } from '@prisma/client';
import { PaginationQuery, PaginationMeta } from '@shared/types';
import { ComplianceFilingRepository } from '../repository/compliance-filing.repository';

/**
 * Cross-category compliance deadline row — deliberately not `ComplianceFilingResponseDto`
 * (that DTO omits `category`, since every existing per-category route already implies
 * it — see that DTO's header comment). This reader spans all four categories at once, so
 * `category` has to travel with each row.
 */
export interface ComplianceDeadlineDto {
  id: string;
  category: 'GST' | 'ITR' | 'TDS' | 'MCA';
  reference: string;
  period: string;
  status: ComplianceFilingStatus;
  dueDate: string | null;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Compliance Dashboard Reader (read side, PRD §10.5/§10.6)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `ComplianceFilingService` (this module's own CRUD service, already exported)
 * is constructed once per `ComplianceCategory` — a route-factory pattern, one
 * instance per GST/ITR/TDS/MCA mount — so it can't answer a cross-category
 * "all upcoming deadlines" dashboard query. This reader is the narrow,
 * unpinned counterpart, mirroring `modules/audit/service/audit-timeline.reader.ts`'s
 * "purpose-built reader beside the CRUD service" precedent exactly.
 *
 * PRD §10.11 / finding: `ComplianceFiling` has no assignee/business/client
 * column at all, so there is no per-staff scoping possible here — every
 * caller, regardless of role, sees the same tenant-wide deadlines. This
 * matches `ComplianceFilingService`'s own existing "no permission gate at
 * all" precedent (see `routes/compliance-filing.routes.ts`'s header comment)
 * — consistent, not a new gap introduced by the dashboard.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class ComplianceDashboardReader {
  constructor(private readonly repository: ComplianceFilingRepository = new ComplianceFilingRepository(prisma)) {}

  async listUpcomingDeadlines(
    tenantId: string,
    filters: { dueBefore?: Date; dueAfter?: Date; statusIn?: ComplianceFilingStatus[] },
    pagination: PaginationQuery,
  ): Promise<{ data: ComplianceDeadlineDto[]; meta: PaginationMeta }> {
    const { data, meta } = await this.repository.search(
      { dueBefore: filters.dueBefore, dueAfter: filters.dueAfter, statusIn: filters.statusIn },
      { ...pagination, sortBy: pagination.sortBy ?? 'dueDate', sortOrder: pagination.sortOrder ?? 'asc' },
      { tenantId },
    );

    return {
      data: data.map((filing) => ({
        id: filing.id,
        category: filing.category,
        reference: filing.reference,
        period: filing.period,
        status: filing.status,
        dueDate: filing.dueDate ? filing.dueDate.toISOString() : null,
      })),
      meta,
    };
  }
}
