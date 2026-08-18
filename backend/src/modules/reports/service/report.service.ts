import { Request } from 'express';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { NotImplementedError } from '@shared/errors';
import { UserRole } from '@shared/enums';
import { ReportsRepository, ReportFilters } from '../repository/reports.repository';
import { toCsv } from '../utils/csv.util';
import { ReportType, ReportExportFormat } from '../dto/report.req.dto';
import { ReportResultResponseDto } from '../dto/report.res.dto';

export interface ReportExportResult {
  contentType: string;
  filename: string;
  body: string;
}

/**
 * Mirrors `DocumentAccessScopeService`/`DashboardAggregationService`'s
 * identical `UNRESTRICTED_COARSE_ROLES` constant exactly (same small,
 * intentional duplication those two files already have between each other —
 * not worth a shared constants module for one three-value array reused a
 * third time). MANAGER is unrestricted here for the same reason it is in
 * both of those: no manager/team-membership relationship exists anywhere in
 * this schema, so a narrower "team reports" scope would have to be
 * fabricated rather than reused.
 */
const UNRESTRICTED_COARSE_ROLES: UserRole[] = [UserRole.TENANT_ADMIN, UserRole.MASTER_ADMIN, UserRole.MANAGER];

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Report Service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Business logic for generating and exporting reports. No HTTP concerns —
 * the controller passes plain values in and gets domain results back,
 * exactly like every other module's service.
 *
 * Reports are a read-only projection layer over existing entities — this
 * service never writes anything, never caches, never schedules, never
 * queues. Every report type is generated synchronously, directly from
 * `ReportsRepository`. Export formats PDF/XLSX throw `NotImplementedError`
 * (501) — no PDF/XLSX generation library exists in this backend; only CSV
 * (which needs no new dependency, just string formatting) is real.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class ReportService extends BaseService {
  constructor(
    req: Request,
    private readonly repository: ReportsRepository = new ReportsRepository(prisma),
  ) {
    super(req);
  }

  async generateReport(type: ReportType, filters: ReportFilters): Promise<ReportResultResponseDto> {
    this.logger.info({ type }, 'Generating report');

    const scopedFilters = this.applyStaffScope(filters);
    const [rows, meta] = await Promise.all([this.buildRows(type, scopedFilters), this.buildMeta(type, scopedFilters)]);

    return {
      type,
      generatedAt: new Date().toISOString(),
      rows,
      ...(meta ? { meta } : {}),
    };
  }

  async exportReport(type: ReportType, filters: ReportFilters, format: ReportExportFormat): Promise<ReportExportResult> {
    if (format !== 'CSV') {
      throw new NotImplementedError(
        `Export format ${format} is not implemented yet — no ${format} generation library exists in this backend. Only CSV export is currently available.`,
      );
    }

    const { rows } = await this.generateReport(type, filters);
    const csv = toCsv(rows);

    this.logger.info({ type, format, rowCount: rows.length }, 'Exported report');

    return {
      contentType: 'text/csv; charset=utf-8',
      filename: `${type.toLowerCase().replace(/_/g, '-')}-report.csv`,
      body: csv,
    };
  }

  /**
   * PRD §10.7 — the Dashboard's "Performance" widget. Composes four existing
   * `ReportsRepository` finders (never a fifth ad-hoc query) — `staffId` set
   * (STAFF, PRD §10.11) narrows every finder to that one person's rows;
   * unset (unrestricted roles) returns tenant-wide figures. Deliberately
   * calls the dashboard-only finders (`findPendingPayments`,
   * `findDocumentActivity`) rather than the fuller PRD §13.2 report versions
   * (`findPaymentsPendingReport`, `findDocumentActivityReport`) — this
   * widget's counts must keep meaning exactly what they meant before §13.2
   * existed. Row counts are computed here, not on the frontend (PRD §10.7
   * "Never compute values on the frontend") — each finder already returns
   * exactly the rows that count. `filters` here is caller-supplied by
   * `DashboardAggregationService`, which already does its own
   * unrestricted-role check — `applyStaffScope()` is not used on this path.
   */
  async getDashboardPerformanceSummary(
    filters: ReportFilters,
  ): Promise<{
    pendingTasks: Array<Record<string, unknown>>;
    pendingPaymentsCount: number;
    documentsUploadedCount: number;
    staffAssignmentSummary: Array<Record<string, unknown>>;
  }> {
    const tenantId = this.tenantId as string;

    const [pendingTasks, pendingPayments, documentActivity, staffAssignmentSummary] = await Promise.all([
      this.repository.findPendingTasks(tenantId, filters),
      this.repository.findPendingPayments(tenantId, filters),
      this.repository.findDocumentActivity(tenantId, filters),
      this.repository.findStaffAssignmentSummary(tenantId, filters),
    ]);

    return {
      pendingTasks,
      pendingPaymentsCount: pendingPayments.length,
      documentsUploadedCount: documentActivity.length,
      staffAssignmentSummary,
    };
  }

  private async buildRows(type: ReportType, filters: ReportFilters): Promise<Array<Record<string, unknown>>> {
    const tenantId = this.tenantId as string;

    switch (type) {
      case 'NEW_LEADS':
        return this.repository.findNewLeads(tenantId, filters);
      case 'CONVERTED_CLIENTS':
        return this.repository.findConvertedClients(tenantId, filters);
      case 'PENDING_TASKS':
        return this.repository.findPendingTasks(tenantId, filters);
      case 'PENDING_DOCUMENTS':
        return this.repository.findPendingDocuments(tenantId, filters);
      case 'PAYMENTS_PENDING':
        return this.repository.findPaymentsPendingReport(tenantId, filters);
      case 'DOCUMENT_ACTIVITY':
        return this.repository.findDocumentActivityReport(tenantId, filters);
      case 'STAFF_ASSIGNMENT_SUMMARY':
        return this.repository.findStaffAssignmentSummary(tenantId, filters);
      case 'MONTHLY_PENDING_WORK':
        return this.repository.findMonthlyPendingWork(tenantId, filters);
      default: {
        // Exhaustiveness check — reportTypeValues is the single source of truth; if a new value is
        // ever added there without a case here, this is a compile-time error, not a silent 404.
        const exhaustiveCheck: never = type;
        throw new NotImplementedError(`Unknown report type: ${exhaustiveCheck}`);
      }
    }
  }

  /** PRD §13.2 report #2 — the only report type with a scalar aggregate that doesn't fit as a row (see `ReportResultResponseDto.meta`'s doc comment). */
  private async buildMeta(type: ReportType, filters: ReportFilters): Promise<Record<string, unknown> | undefined> {
    if (type !== 'CONVERTED_CLIENTS') return undefined;
    return this.repository.getConvertedClientsSummary(this.tenantId as string, filters);
  }

  /**
   * PRD §13.2 permissions — "Staff: only own reports. Managers/Tenant Admin/
   * Master Admin: entire firm." Without this, `filters.staffId` was purely
   * caller-supplied and unenforced: any `reports:read` holder could see the
   * whole tenant simply by omitting it from the query. Reuses the exact
   * `isUnrestricted()` pattern `DashboardAggregationService` already
   * established for the identical PRD §10.11 concern.
   */
  private applyStaffScope(filters: ReportFilters): ReportFilters {
    if (this.isUnrestricted()) return filters;
    return { ...filters, staffId: this.userId };
  }

  private isUnrestricted(): boolean {
    const role = this.req.user?.role;
    return !role || UNRESTRICTED_COARSE_ROLES.includes(role);
  }
}
