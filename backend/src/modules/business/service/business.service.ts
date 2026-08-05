import { Request } from 'express';
import { Business, BusinessType, AuditEventType } from '@prisma/client';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { PaginationMeta } from '@shared/types';
import { AuditLogRecorder } from '@modules/audit';
import { StorageQuotaService, StorageSummary } from '@modules/documents';
import { BusinessRepository } from '../repository/business.repository';
import { BusinessTypeRepository } from '../repository/business-type.repository';
import { CreateBusinessDto, UpdateBusinessDto, ListBusinessesQueryDto } from '../dto/business.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Business Service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Business logic for the `Business` entity. No HTTP concerns — callers
 * (controllers) pass plain values in and get domain entities back.
 *
 * `this.tenantId`/`this.userId` come from `BaseService` (derived from the
 * authenticated request); every repository call is scoped with them, so
 * tenant isolation and audit stamping happen automatically. Mirrors
 * `modules/projects/service/project.service.ts`.
 *
 * Unlike `ProjectService`, there is no status-transition state machine here
 * (Business's `status` column isn't settable through any endpoint yet — see
 * `schemas/business.schema.ts`) and no pre-create uniqueness guard (PAN/GSTIN/
 * CIN have no unique constraint in the Prisma schema, unlike Project.code).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class BusinessService extends BaseService {
  constructor(
    req: Request,
    private readonly businessRepository: BusinessRepository = new BusinessRepository(prisma),
    private readonly businessTypeRepository: BusinessTypeRepository = new BusinessTypeRepository(prisma),
    private readonly storageQuotaService: StorageQuotaService = new StorageQuotaService(),
    private readonly auditLogRecorder: AuditLogRecorder = new AuditLogRecorder(),
  ) {
    super(req);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Create / Update / Delete
  // ────────────────────────────────────────────────────────────────────────────

  async createBusiness(dto: CreateBusinessDto): Promise<Business> {
    this.logger.info({ name: dto.name, typeId: dto.typeId }, 'Creating business');

    // An invalid typeId surfaces as a 409 (P2003 foreign key violation),
    // handled centrally by errorMiddleware — no pre-check needed here.
    return this.businessRepository.create(
      {
        typeId: dto.typeId,
        name: dto.name,
        legalName: dto.legalName ?? null,
        pan: dto.pan ?? null,
        gstin: dto.gstin ?? null,
        cin: dto.cin ?? null,
        incorporationDate: dto.incorporationDate ?? null,
        financialYearStart: dto.financialYearStart ?? 4,
        industry: dto.industry ?? null,
        createdBy: this.userId ?? null,
      },
      { tenantId: this.tenantId },
    );
  }

  async updateBusiness(id: string, dto: UpdateBusinessDto): Promise<Business> {
    const existing = await this.businessRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'Business');

    this.logger.info({ businessId: id }, 'Updating business');

    const updated = await this.businessRepository.update(id, dto, { tenantId: this.tenantId });

    // PRD §7.4 — "changing upload limits must generate audit logs" extends to the business
    // quota override; only fires when the field is actually part of this diff, and only if a
    // real change occurred (a no-op re-set to the same value must not audit-spam).
    if (dto.storageQuotaMb !== undefined && dto.storageQuotaMb !== existing.storageQuotaMb && this.userId && this.tenantId) {
      await this.auditLogRecorder.record({
        tenantId: this.tenantId,
        actorId: this.userId,
        eventType: AuditEventType.SETTINGS_UPDATE,
        description: `Changed storage quota for business "${updated.name}" from ${existing.storageQuotaMb ?? 'default'} MB to ${updated.storageQuotaMb ?? 'default'} MB`,
        targetType: 'Business',
        targetId: updated.id,
        ipAddress: this.req.ip ?? null,
      });
    }

    return updated;
  }

  async deleteBusiness(id: string): Promise<void> {
    const existing = await this.businessRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'Business');

    this.logger.info({ businessId: id }, 'Deleting business');

    await this.businessRepository.delete(id, { tenantId: this.tenantId, userId: this.userId });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Reads
  // ────────────────────────────────────────────────────────────────────────────

  async getBusinessById(id: string): Promise<Business> {
    const business = await this.businessRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(business, 'Business');
    return business;
  }

  /**
   * PRD §7.4 — live storage usage summary for the Business Detail page (Storage Used / Remaining
   * / quota progress bar). Reuses `StorageQuotaService` — the same engine `DocumentService`
   * enforces uploads against — rather than a second usage computation. Only called from
   * `GET /business/:id`, never the list endpoint (see `BusinessMapper.toResponseDto()`).
   */
  async getBusinessStorageUsage(id: string): Promise<StorageSummary> {
    const business = await this.businessRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(business, 'Business');
    return this.storageQuotaService.getBusinessStorageSummary(this.tenantId as string, id);
  }

  async listBusinesses(query: ListBusinessesQueryDto): Promise<{ data: Business[]; meta: PaginationMeta }> {
    return this.businessRepository.search(
      {
        typeId: query.typeId,
        status: query.status,
        search: query.search,
      },
      {
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
      { tenantId: this.tenantId },
    );
  }

  /** Reference data for the frontend's Business Type picker — shared across tenants, no pagination. */
  async listBusinessTypes(): Promise<BusinessType[]> {
    return this.businessTypeRepository.listActive();
  }
}
