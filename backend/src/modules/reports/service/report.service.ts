import { Request } from 'express';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { NotImplementedError } from '@shared/errors';
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
 * `ReportsRepository`. `PENDING_DOCUMENTS` throws `NotImplementedError`
 * (501) with a precise reason — `Document` has no review/signature status
 * column anywhere in this schema, so that report cannot be generated
 * without fabricating data, which this module must never do. Export
 * formats PDF/XLSX likewise throw `NotImplementedError` — no PDF/XLSX
 * generation library exists in this backend; only CSV (which needs no new
 * dependency, just string formatting) is real.
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

    const rows = await this.buildRows(type, filters);

    return {
      type,
      generatedAt: new Date().toISOString(),
      rows,
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

  private async buildRows(type: ReportType, filters: ReportFilters): Promise<Array<Record<string, unknown>>> {
    const tenantId = this.tenantId as string;

    switch (type) {
      case 'NEW_LEADS':
        return this.repository.findNewLeads(tenantId, filters);
      case 'CONVERTED_CLIENTS':
        return this.repository.findConvertedClients(tenantId, filters);
      case 'PENDING_TASKS':
        return this.repository.findPendingTasks(tenantId, filters);
      case 'PAYMENTS_PENDING':
        return this.repository.findPendingPayments(tenantId, filters);
      case 'DOCUMENT_ACTIVITY':
        return this.repository.findDocumentActivity(tenantId, filters);
      case 'STAFF_ASSIGNMENT_SUMMARY':
        return this.repository.findStaffAssignmentSummary(tenantId, filters);
      case 'MONTHLY_PENDING_WORK':
        return this.repository.findMonthlyPendingWork(tenantId, filters);
      case 'PENDING_DOCUMENTS':
        throw new NotImplementedError(
          'The Pending Documents report cannot be generated yet: the Document model has no review/signature status column, and no document-approval workflow module exists in this backend. Add that status field/workflow first.',
        );
      default: {
        // Exhaustiveness check — reportTypeValues is the single source of truth; if a new value is
        // ever added there without a case here, this is a compile-time error, not a silent 404.
        const exhaustiveCheck: never = type;
        throw new NotImplementedError(`Unknown report type: ${exhaustiveCheck}`);
      }
    }
  }
}
