import { Request } from 'express';
import { ClientStatus, ContactRoleType, Lead, LeadStage } from '@prisma/client';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { ConflictError, UnauthorizedError } from '@shared/errors';
import { PaginationMeta } from '@shared/types';
import { BusinessService } from '@modules/business';
import { ContactRoleRepository } from '@modules/contacts';
import { LeadRepository } from '../repository/lead.repository';
import { LeadStageRepository } from '../repository/lead-stage.repository';
import { LeadConversionRepository } from '../repository/lead-conversion.repository';
import { ClientRepository } from '../repository/client.repository';
import { CreateLeadDto, UpdateLeadDto, ListLeadsQueryDto, ConvertLeadDto } from '../dto/lead.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Lead Service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Business logic for the `Lead` entity and its conversion into a `Client`.
 * No HTTP concerns — callers (controllers) pass plain values in and get
 * domain entities back. Mirrors `modules/business/service/business.service.ts`.
 *
 * `convertLead()` reuses `BusinessService.getBusinessById()` (read-only
 * validation, safe outside a transaction) and `ContactRoleRepository`
 * directly (not `ContactService.assignContactRole()` — see that field's
 * import comment in `modules/contacts/index.ts` for why: a service-owned
 * transaction can't accept an externally-provided `tx`, and the whole
 * conversion must commit or roll back as one unit).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class LeadService extends BaseService {
  constructor(
    req: Request,
    private readonly leadRepository: LeadRepository = new LeadRepository(prisma),
    private readonly leadStageRepository: LeadStageRepository = new LeadStageRepository(prisma),
    private readonly leadConversionRepository: LeadConversionRepository = new LeadConversionRepository(prisma),
    private readonly clientRepository: ClientRepository = new ClientRepository(prisma),
    private readonly contactRoleRepository: ContactRoleRepository = new ContactRoleRepository(prisma),
    private readonly businessService: BusinessService = new BusinessService(req),
  ) {
    super(req);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Create / Update / Delete
  // ────────────────────────────────────────────────────────────────────────────

  async createLead(dto: CreateLeadDto): Promise<Lead> {
    this.logger.info({ title: dto.title, sourceId: dto.sourceId, stageId: dto.stageId }, 'Creating lead');

    // An invalid businessId/contactId/sourceId/stageId surfaces as a 409
    // (P2003 foreign key violation), handled centrally by errorMiddleware —
    // no pre-check needed here.
    return this.leadRepository.create(
      {
        businessId: dto.businessId ?? null,
        contactId: dto.contactId ?? null,
        title: dto.title,
        sourceId: dto.sourceId,
        stageId: dto.stageId,
        expectedRevenue: dto.expectedRevenue ?? null,
        probability: dto.probability ?? null,
        expectedCloseDate: dto.expectedCloseDate ?? null,
      },
      { tenantId: this.tenantId },
    );
  }

  async updateLead(id: string, dto: UpdateLeadDto): Promise<Lead> {
    const existing = await this.leadRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'Lead');

    this.logger.info({ leadId: id }, 'Updating lead');

    return this.leadRepository.update(id, dto, { tenantId: this.tenantId });
  }

  async deleteLead(id: string): Promise<void> {
    const existing = await this.leadRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'Lead');

    this.logger.info({ leadId: id }, 'Deleting lead');

    await this.leadRepository.delete(id, { tenantId: this.tenantId, userId: this.userId });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Reads
  // ────────────────────────────────────────────────────────────────────────────

  async getLeadById(id: string): Promise<Lead> {
    const lead = await this.leadRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(lead, 'Lead');
    return lead;
  }

  async listLeads(query: ListLeadsQueryDto): Promise<{ data: Lead[]; meta: PaginationMeta }> {
    return this.leadRepository.search(
      { stageId: query.stageId, sourceId: query.sourceId, search: query.search },
      {
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
      { tenantId: this.tenantId },
    );
  }

  /** Reference data for the frontend's Stage picker/filter — tenant-scoped, ordered for pipeline display. */
  async listStages(): Promise<LeadStage[]> {
    return this.leadStageRepository.listAll({ tenantId: this.tenantId });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Conversion
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Converts a lead into a client: find-or-create the Client for the lead's
   * business, ensure a primary ContactRole for the lead's contact (if any),
   * and record the LeadConversion. Wrapped in a single Prisma transaction —
   * if any step fails (including the final unique-constraint check on
   * `LeadConversion.clientId`), everything rolls back and no partial state
   * is left behind.
   *
   * Conversion is only possible when the lead already has a `businessId` —
   * Lead carries no name/PAN/GSTIN/legalName fields of its own, so there is
   * no data to fabricate a *new* Business from. A lead with no linked
   * business must be linked to one first (via PATCH /crm/:id) before it can
   * be converted.
   */
  async convertLead(id: string, dto: ConvertLeadDto): Promise<Lead> {
    // Captured into a local so TypeScript's narrowing survives into the
    // transaction closure below (LeadConversion.convertedById is required,
    // unlike the optional createdBy/deletedBy fields elsewhere — narrowing
    // on `this.userId` itself doesn't persist through a nested closure).
    const userId = this.userId;
    if (!userId) {
      throw new UnauthorizedError();
    }

    const lead = await this.leadRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(lead, 'Lead');

    const existingConversion = await this.leadConversionRepository.findByLead(id, { tenantId: this.tenantId });
    if (existingConversion) {
      throw new ConflictError('This lead has already been converted.');
    }

    if (!lead.businessId) {
      throw new ConflictError('This lead must be linked to a business before it can be converted.');
    }
    const businessId = lead.businessId;

    // Validates the business exists (and belongs to this tenant) — a read,
    // safe to run before the transaction opens.
    await this.businessService.getBusinessById(businessId);

    this.logger.info({ leadId: id, businessId }, 'Converting lead');

    await this.transaction(async (tx) => {
      let client = await this.clientRepository.findByBusiness(businessId, { tenantId: this.tenantId, tx });
      if (!client) {
        client = await this.clientRepository.create(
          { businessId, status: ClientStatus.ACTIVE },
          { tenantId: this.tenantId, tx },
        );
      }

      // "Primary Contact → Business ContactRole": only possible when the
      // lead actually has a linked contact — there is no contact to
      // fabricate a role for otherwise, so this step is skipped, not failed.
      if (lead.contactId) {
        const existingRole = await this.contactRoleRepository.findExisting(
          businessId,
          lead.contactId,
          ContactRoleType.CLIENT_REPRESENTATIVE,
          { tenantId: this.tenantId, tx },
        );

        if (!existingRole) {
          await this.contactRoleRepository.clearPrimaryForBusiness(businessId, { tenantId: this.tenantId, tx });
          await this.contactRoleRepository.create(
            {
              businessId,
              contactId: lead.contactId,
              roleType: ContactRoleType.CLIENT_REPRESENTATIVE,
              customTitle: null,
              isPrimary: true,
              sharePercent: null,
            },
            { tenantId: this.tenantId, tx },
          );
        }
      }

      // Unique on `clientId` — if another lead for the same business
      // converted concurrently, this throws (P2002) and the whole
      // transaction, including the ContactRole/Client writes above, rolls back.
      await this.leadConversionRepository.create(
        {
          leadId: id,
          clientId: client.id,
          convertedById: userId,
          notes: dto.notes ?? null,
        },
        { tenantId: this.tenantId, tx },
      );
    });

    return lead;
  }
}
