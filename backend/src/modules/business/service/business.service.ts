import { Request } from 'express';
import { Business, BusinessType, BusinessAssignment, BusinessNote, AuditEventType } from '@prisma/client';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { ConflictError, NotFoundError, UnauthorizedError } from '@shared/errors';
import { PaginationMeta, PaginationQuery } from '@shared/types';
import { AuditLogRecorder, AuditTimelineReader, AuditLogResponseDto } from '@modules/audit';
import { StorageQuotaService, StorageSummary } from '@modules/documents';
import { BusinessRepository } from '../repository/business.repository';
import { BusinessTypeRepository } from '../repository/business-type.repository';
import { BusinessAssignmentRepository } from '../repository/business-assignment.repository';
import { BusinessNoteRepository } from '../repository/business-note.repository';
import { CreateBusinessDto, UpdateBusinessDto, ListBusinessesQueryDto, AssignBusinessDto, CreateBusinessNoteDto } from '../dto/business.req.dto';

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
    // Appended after the original dependency list (rather than interleaved) so
    // existing positional-mock test call sites don't shift.
    private readonly businessAssignmentRepository: BusinessAssignmentRepository = new BusinessAssignmentRepository(prisma),
    // PRD §8.6/§8.11 additions — same "append, don't interleave" rule.
    private readonly businessNoteRepository: BusinessNoteRepository = new BusinessNoteRepository(prisma),
    private readonly auditTimelineReader: AuditTimelineReader = new AuditTimelineReader(),
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
        tradeName: dto.tradeName ?? null,
        pan: dto.pan ?? null,
        gstin: dto.gstin ?? null,
        cin: dto.cin ?? null,
        din: dto.din ?? null,
        tan: dto.tan ?? null,
        incorporationDate: dto.incorporationDate ?? null,
        financialYearStart: dto.financialYearStart ?? 4,
        industry: dto.industry ?? null,
        website: dto.website ?? null,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        createdBy: this.userId ?? null,
      },
      { tenantId: this.tenantId },
    );
  }

  /**
   * PRD §8.11 ("PAN updated"/"GST updated"/timeline) — whether `field` is both
   * part of this update's diff (`dto[field] !== undefined`) and genuinely
   * different from the current value, so a no-op re-set of the same value
   * never audit-spams. Dates need `.getTime()` comparison since Zod's
   * `z.coerce.date()` always produces a new `Date` instance, which would
   * otherwise always compare unequal to Prisma's own `Date` via `!==`.
   */
  private hasBusinessFieldChanged<K extends keyof UpdateBusinessDto>(
    dto: UpdateBusinessDto,
    existing: Business,
    field: K,
  ): boolean {
    if (dto[field] === undefined) return false;
    const newValue = dto[field];
    const oldValue = existing[field as unknown as keyof Business];
    if (newValue instanceof Date || oldValue instanceof Date) {
      return new Date(newValue as Date).getTime() !== new Date(oldValue as Date).getTime();
    }
    return newValue !== oldValue;
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

    // PRD §8.11 — "PAN updated"/"GST updated" are their own timeline events, distinct from the
    // combined "details updated" event below (matches the PRD's explicit examples list).
    if (this.hasBusinessFieldChanged(dto, existing, 'pan') && this.userId && this.tenantId) {
      await this.auditLogRecorder.record({
        tenantId: this.tenantId,
        actorId: this.userId,
        eventType: AuditEventType.BUSINESS_PAN_UPDATED,
        description: `Updated PAN for business "${updated.name}"`,
        targetType: 'Business',
        targetId: updated.id,
        ipAddress: this.req.ip ?? null,
      });
    }

    if (this.hasBusinessFieldChanged(dto, existing, 'gstin') && this.userId && this.tenantId) {
      await this.auditLogRecorder.record({
        tenantId: this.tenantId,
        actorId: this.userId,
        eventType: AuditEventType.BUSINESS_GST_UPDATED,
        description: `Updated GST for business "${updated.name}"`,
        targetType: 'Business',
        targetId: updated.id,
        ipAddress: this.req.ip ?? null,
      });
    }

    // One combined event for every other editable field — mirrors `SETTINGS_UPDATE`'s same
    // "don't mint an enum value per field" restraint.
    const otherDetailFields: (keyof UpdateBusinessDto)[] = [
      'name',
      'legalName',
      'tradeName',
      'cin',
      'din',
      'tan',
      'incorporationDate',
      'financialYearStart',
      'industry',
      'website',
      'phone',
      'email',
    ];
    if (
      otherDetailFields.some((field) => this.hasBusinessFieldChanged(dto, existing, field)) &&
      this.userId &&
      this.tenantId
    ) {
      await this.auditLogRecorder.record({
        tenantId: this.tenantId,
        actorId: this.userId,
        eventType: AuditEventType.BUSINESS_DETAILS_UPDATED,
        description: `Updated details for business "${updated.name}"`,
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
        assignedStaffUserId: query.assignedStaffUserId,
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

  /**
   * PRD §8.11 — this business's timeline, reading back every `AuditLog` entry
   * written for it (assignment changes, PAN/GST/details updates, notes,
   * lead conversion, etc.) rather than a second history table.
   */
  async getBusinessTimeline(
    id: string,
    pagination: PaginationQuery,
  ): Promise<{ data: AuditLogResponseDto[]; meta: PaginationMeta }> {
    const business = await this.businessRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(business, 'Business');

    return this.auditTimelineReader.getTimeline('Business', id, this.tenantId as string, pagination);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Staff Assignment (PRD §8.5) — multiple staff per Business, each with a role
  // (e.g. Relationship Manager/Accountant/Auditor/Reviewer). Also the scoping
  // source `DocumentAccessScopeService` reads to restrict an Accountant's
  // document access to only their assigned Businesses.
  // ────────────────────────────────────────────────────────────────────────────

  async listBusinessAssignments(businessId: string): Promise<BusinessAssignment[]> {
    const business = await this.businessRepository.findById(businessId, { tenantId: this.tenantId });
    this.validateExists(business, 'Business');

    return this.businessAssignmentRepository.findByBusiness(businessId, { tenantId: this.tenantId });
  }

  async assignBusinessUser(businessId: string, dto: AssignBusinessDto): Promise<BusinessAssignment> {
    const business = await this.businessRepository.findById(businessId, { tenantId: this.tenantId });
    this.validateExists(business, 'Business');

    const existing = await this.businessAssignmentRepository.findExisting(businessId, dto.userId, {
      tenantId: this.tenantId,
    });
    if (existing) {
      throw new ConflictError('This user is already assigned to this business.');
    }

    this.logger.info({ businessId, userId: dto.userId, role: dto.role }, 'Assigning user to business');

    // An invalid userId surfaces as a 409 (P2003 foreign key violation),
    // handled centrally by errorMiddleware — no pre-check needed here.
    const assignment = await this.businessAssignmentRepository.create(
      { businessId, userId: dto.userId, role: dto.role },
      { tenantId: this.tenantId },
    );

    if (this.userId && this.tenantId) {
      await this.auditLogRecorder.record({
        tenantId: this.tenantId,
        actorId: this.userId,
        eventType: AuditEventType.BUSINESS_ASSIGNMENT_CHANGED,
        description: `Assigned a staff member as ${dto.role} to business "${business.name}"`,
        targetType: 'Business',
        targetId: businessId,
        ipAddress: this.req.ip ?? null,
      });
    }

    return assignment;
  }

  async unassignBusinessUser(businessId: string, userId: string): Promise<void> {
    const business = await this.businessRepository.findById(businessId, { tenantId: this.tenantId });
    this.validateExists(business, 'Business');

    const existing = await this.businessAssignmentRepository.findExisting(businessId, userId, {
      tenantId: this.tenantId,
    });
    if (!existing) {
      throw new NotFoundError('Business assignment');
    }

    this.logger.info({ businessId, userId }, 'Unassigning user from business');

    await this.businessAssignmentRepository.forceDelete(existing.id, { tenantId: this.tenantId });

    if (this.userId && this.tenantId) {
      await this.auditLogRecorder.record({
        tenantId: this.tenantId,
        actorId: this.userId,
        eventType: AuditEventType.BUSINESS_ASSIGNMENT_CHANGED,
        description: `Removed a staff assignment from business "${business.name}"`,
        targetType: 'Business',
        targetId: businessId,
        ipAddress: this.req.ip ?? null,
      });
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Notes (PRD §8.6) — internal notes on a Business (post-conversion / always-
  // was-a-client). Only firm users can read them — never exposed to the Client
  // portal. Mirrors `LeadService`'s `listLeadNotes`/`addLeadNote` exactly.
  // ────────────────────────────────────────────────────────────────────────────

  async listBusinessNotes(businessId: string): Promise<BusinessNote[]> {
    const business = await this.businessRepository.findById(businessId, { tenantId: this.tenantId });
    this.validateExists(business, 'Business');

    return this.businessNoteRepository.findByBusiness(businessId, { tenantId: this.tenantId });
  }

  async addBusinessNote(businessId: string, dto: CreateBusinessNoteDto): Promise<BusinessNote> {
    const business = await this.businessRepository.findById(businessId, { tenantId: this.tenantId });
    this.validateExists(business, 'Business');

    if (!this.userId) {
      throw new UnauthorizedError();
    }

    this.logger.info({ businessId }, 'Adding business note');

    // An invalid documentId surfaces as a 409 (P2003 foreign key violation),
    // handled centrally by errorMiddleware — no pre-check needed here.
    const note = await this.businessNoteRepository.create(
      {
        businessId,
        authorId: this.userId,
        content: dto.content,
        documentId: dto.documentId ?? null,
      },
      { tenantId: this.tenantId },
    );

    await this.auditLogRecorder.record({
      tenantId: this.tenantId as string,
      actorId: this.userId,
      eventType: AuditEventType.BUSINESS_NOTE_ADDED,
      description: `Added a note to business "${business.name}"`,
      targetType: 'Business',
      targetId: businessId,
      ipAddress: this.req.ip ?? null,
    });

    return note;
  }
}
