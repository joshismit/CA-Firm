import { Request } from 'express';
import { ComplianceFiling, ComplianceCategory } from '@prisma/client';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { PaginationMeta } from '@shared/types';
import { ComplianceFilingRepository } from '../repository/compliance-filing.repository';
import { CreateComplianceFilingDto, UpdateComplianceFilingDto, ListComplianceFilingsQueryDto } from '../dto/compliance-filing.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Compliance Filing Service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Business logic for `ComplianceFiling`, generic across all four Compliance
 * areas (GST/ITR/TDS/MCA) — the caller-provided `category` (fixed per
 * mounted route, see `routes/compliance-filing.routes.ts`) scopes every
 * operation. No HTTP concerns — the controller passes plain values in and
 * gets domain entities back, exactly like every other module's service.
 * Mirrors `modules/contacts/service/contact.service.ts`.
 *
 * `status`/`filedDate` are stored on the model (the frontend's response
 * type reads both) but neither `CreateComplianceFilingDto` nor
 * `UpdateComplianceFilingDto` ever carries them — the frontend's own
 * `ComplianceFilingForm` never collects a status or filed-date field (see
 * that component; only reference/period/dueDate/notes are editable). Every
 * filing is therefore created as `DRAFT` (the schema's default) and stays
 * that way through this API — there is no status-transition/"mark filed"
 * endpoint to build, because the frontend never asks for one. Known
 * limitation, reported rather than fabricated.
 *
 * No permission checks are enforced here — the audit found no compliance
 * permission resource in either the frontend's `PERMISSION_RESOURCES`
 * registry or the backend's `PermissionResource` enum, and the frontend's
 * own `ComplianceListPage.tsx` renders its "New filing" action ungated for
 * exactly that reason. Per explicit product decision, this mirrors that
 * ungated behavior rather than inventing a permission resource.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class ComplianceFilingService extends BaseService {
  constructor(
    req: Request,
    private readonly category: ComplianceCategory,
    private readonly repository: ComplianceFilingRepository = new ComplianceFilingRepository(prisma),
  ) {
    super(req);
  }

  async listFilings(query: ListComplianceFilingsQueryDto): Promise<{ data: ComplianceFiling[]; meta: PaginationMeta }> {
    return this.repository.search(
      { category: this.category, search: query.search, status: query.status },
      { page: query.page, limit: query.limit, sortBy: query.sortBy, sortOrder: query.sortOrder },
      { tenantId: this.tenantId },
    );
  }

  async getFilingById(id: string): Promise<ComplianceFiling> {
    const filing = await this.repository.findByIdInCategory(id, this.category, { tenantId: this.tenantId });
    this.validateExists(filing, 'Filing');
    return filing;
  }

  async createFiling(dto: CreateComplianceFilingDto): Promise<ComplianceFiling> {
    this.logger.info({ category: this.category, reference: dto.reference }, 'Creating compliance filing');

    return this.repository.create(
      {
        category: this.category,
        reference: dto.reference,
        period: dto.period,
        dueDate: dto.dueDate ?? null,
        notes: dto.notes ?? null,
      },
      { tenantId: this.tenantId },
    );
  }

  async updateFiling(id: string, dto: UpdateComplianceFilingDto): Promise<ComplianceFiling> {
    await this.getFilingById(id);

    this.logger.info({ category: this.category, filingId: id }, 'Updating compliance filing');

    return this.repository.update(id, dto, { tenantId: this.tenantId });
  }

  async deleteFiling(id: string): Promise<void> {
    await this.getFilingById(id);

    this.logger.info({ category: this.category, filingId: id }, 'Deleting compliance filing');

    await this.repository.delete(id, { tenantId: this.tenantId });
  }
}
