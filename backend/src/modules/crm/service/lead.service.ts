import { Request } from 'express';
import { AuditEventType, ClientStatus, ContactRoleType, Lead, LeadStage, LeadNote, LeadAssignment, Client } from '@prisma/client';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { ConflictError, NotFoundError, UnauthorizedError } from '@shared/errors';
import { PaginationMeta, PaginationQuery } from '@shared/types';
import { AuditLogRecorder, AuditTimelineReader, AuditLogResponseDto } from '@modules/audit';
import { BusinessService } from '@modules/business';
import { ContactRoleRepository } from '@modules/contacts';
import { TaskService } from '@modules/tasks';
import { LeadRepository } from '../repository/lead.repository';
import { LeadStageRepository } from '../repository/lead-stage.repository';
import { LeadConversionRepository } from '../repository/lead-conversion.repository';
import { LeadNoteRepository } from '../repository/lead-note.repository';
import { LeadAssignmentRepository } from '../repository/lead-assignment.repository';
import { ClientRepository } from '../repository/client.repository';
import {
  CreateLeadDto,
  UpdateLeadDto,
  ListLeadsQueryDto,
  ConvertLeadDto,
  CreateLeadNoteDto,
  AssignLeadDto,
  SendProposalDto,
  RespondProposalDto,
} from '../dto/lead.req.dto';
import { LeadDashboardResponseDto } from '../dto/lead.res.dto';

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

/** `Client` with its `business` relation eager-loaded — the shape `listAssignedClients()` always returns (it always requests that include). */
export interface ClientWithBusiness extends Client {
  business: { id: string; name: string } | null;
}

export class LeadService extends BaseService {
  constructor(
    req: Request,
    private readonly leadRepository: LeadRepository = new LeadRepository(prisma),
    private readonly leadStageRepository: LeadStageRepository = new LeadStageRepository(prisma),
    private readonly leadConversionRepository: LeadConversionRepository = new LeadConversionRepository(prisma),
    private readonly clientRepository: ClientRepository = new ClientRepository(prisma),
    private readonly contactRoleRepository: ContactRoleRepository = new ContactRoleRepository(prisma),
    private readonly businessService: BusinessService = new BusinessService(req),
    private readonly auditLogRecorder: AuditLogRecorder = new AuditLogRecorder(),
    // Appended after the original dependency list (rather than interleaved) so
    // existing positional-mock test call sites don't shift — see this
    // codebase's convention for adding deps to an already-tested constructor.
    private readonly leadNoteRepository: LeadNoteRepository = new LeadNoteRepository(prisma),
    private readonly leadAssignmentRepository: LeadAssignmentRepository = new LeadAssignmentRepository(prisma),
    // PRD §8.2/§8.10/§8.11 additions — same "append, don't interleave" rule.
    private readonly auditTimelineReader: AuditTimelineReader = new AuditTimelineReader(),
    private readonly taskService: TaskService = new TaskService(req),
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
    const lead = await this.leadRepository.create(
      {
        businessId: dto.businessId ?? null,
        contactId: dto.contactId ?? null,
        title: dto.title,
        sourceId: dto.sourceId,
        stageId: dto.stageId,
        priority: dto.priority ?? null,
        expectedRevenue: dto.expectedRevenue ?? null,
        probability: dto.probability ?? null,
        expectedCloseDate: dto.expectedCloseDate ?? null,
        interestedServices: dto.interestedServices ?? [],
      },
      { tenantId: this.tenantId },
    );

    if (this.userId && this.tenantId) {
      await this.auditLogRecorder.record({
        tenantId: this.tenantId,
        actorId: this.userId,
        eventType: AuditEventType.LEAD_CREATED,
        description: `Created lead "${lead.title}"`,
        targetType: 'Lead',
        targetId: lead.id,
        ipAddress: this.req.ip ?? null,
      });
    }

    return lead;
  }

  async updateLead(id: string, dto: UpdateLeadDto): Promise<Lead> {
    const existing = await this.leadRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'Lead');

    this.logger.info({ leadId: id }, 'Updating lead');

    const updated = await this.leadRepository.update(id, dto, { tenantId: this.tenantId });

    // "Status Changed" (PRD §8.11) — only fires when stageId is actually part of
    // this diff and genuinely differs, so a no-op PATCH doesn't audit-spam.
    if (dto.stageId !== undefined && dto.stageId !== existing.stageId && this.userId && this.tenantId) {
      await this.auditLogRecorder.record({
        tenantId: this.tenantId,
        actorId: this.userId,
        eventType: AuditEventType.LEAD_STAGE_CHANGED,
        description: `Changed lead "${updated.title}" stage`,
        targetType: 'Lead',
        targetId: updated.id,
        ipAddress: this.req.ip ?? null,
      });
    }

    return updated;
  }

  async deleteLead(id: string): Promise<void> {
    const existing = await this.leadRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'Lead');

    this.logger.info({ leadId: id }, 'Deleting lead');

    await this.leadRepository.delete(id, { tenantId: this.tenantId, userId: this.userId });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Proposal (PRD §8.2) — dedicated actions rather than a raw PATCH, so the
  // three timestamps can never be set out of order by a client.
  // ────────────────────────────────────────────────────────────────────────────

  async sendProposal(id: string, dto: SendProposalDto): Promise<Lead> {
    const existing = await this.leadRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'Lead');

    this.logger.info({ leadId: id }, 'Sending proposal');

    const updated = await this.leadRepository.update(
      id,
      {
        proposalSentAt: new Date(),
        proposalAcceptedAt: null,
        proposalRejectedAt: null,
        proposalValue: dto.proposalValue ?? existing.proposalValue,
        proposalRemarks: dto.proposalRemarks ?? existing.proposalRemarks,
      },
      { tenantId: this.tenantId },
    );

    if (this.userId && this.tenantId) {
      await this.auditLogRecorder.record({
        tenantId: this.tenantId,
        actorId: this.userId,
        eventType: AuditEventType.PROPOSAL_SENT,
        description: `Sent a proposal for lead "${updated.title}"`,
        targetType: 'Lead',
        targetId: updated.id,
        ipAddress: this.req.ip ?? null,
      });
    }

    return updated;
  }

  async acceptProposal(id: string, dto: RespondProposalDto): Promise<Lead> {
    const existing = await this.leadRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'Lead');

    if (!existing.proposalSentAt) {
      throw new ConflictError('No proposal has been sent for this lead yet.');
    }

    this.logger.info({ leadId: id }, 'Accepting proposal');

    const updated = await this.leadRepository.update(
      id,
      {
        proposalAcceptedAt: new Date(),
        proposalRejectedAt: null,
        proposalRemarks: dto.proposalRemarks ?? existing.proposalRemarks,
      },
      { tenantId: this.tenantId },
    );

    if (this.userId && this.tenantId) {
      await this.auditLogRecorder.record({
        tenantId: this.tenantId,
        actorId: this.userId,
        eventType: AuditEventType.PROPOSAL_ACCEPTED,
        description: `Accepted the proposal for lead "${updated.title}"`,
        targetType: 'Lead',
        targetId: updated.id,
        ipAddress: this.req.ip ?? null,
      });
    }

    return updated;
  }

  async rejectProposal(id: string, dto: RespondProposalDto): Promise<Lead> {
    const existing = await this.leadRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'Lead');

    if (!existing.proposalSentAt) {
      throw new ConflictError('No proposal has been sent for this lead yet.');
    }

    this.logger.info({ leadId: id }, 'Rejecting proposal');

    const updated = await this.leadRepository.update(
      id,
      {
        proposalRejectedAt: new Date(),
        proposalAcceptedAt: null,
        proposalRemarks: dto.proposalRemarks ?? existing.proposalRemarks,
      },
      { tenantId: this.tenantId },
    );

    if (this.userId && this.tenantId) {
      await this.auditLogRecorder.record({
        tenantId: this.tenantId,
        actorId: this.userId,
        eventType: AuditEventType.PROPOSAL_REJECTED,
        description: `Rejected the proposal for lead "${updated.title}"`,
        targetType: 'Lead',
        targetId: updated.id,
        ipAddress: this.req.ip ?? null,
      });
    }

    return updated;
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
      { stageId: query.stageId, sourceId: query.sourceId, priority: query.priority, search: query.search },
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

  /**
   * PRD §8.11 — this lead's timeline, reading back every `AuditLog` entry
   * written for it (`LEAD_CREATED`, `LEAD_STAGE_CHANGED`, `PROPOSAL_SENT`,
   * etc.) rather than a second history table.
   */
  async getLeadTimeline(
    id: string,
    pagination: PaginationQuery,
  ): Promise<{ data: AuditLogResponseDto[]; meta: PaginationMeta }> {
    const lead = await this.leadRepository.findById(id, { tenantId: this.tenantId });
    this.validateExists(lead, 'Lead');

    return this.auditTimelineReader.getTimeline('Lead', id, this.tenantId as string, pagination);
  }

  /** PRD §8.10 — CRM dashboard counts (`GET /crm/dashboard`). */
  async getDashboardStats(): Promise<LeadDashboardResponseDto> {
    const tenantId = this.tenantId as string;

    const [leadStats, convertedClients, archivedClients, upcomingFollowUps] = await Promise.all([
      this.leadRepository.getDashboardStats({ tenantId }),
      this.clientRepository.countByStatus(
        [ClientStatus.ACTIVE, ClientStatus.INACTIVE, ClientStatus.SUSPENDED],
        { tenantId },
      ),
      this.clientRepository.countByStatus([ClientStatus.FORMER], { tenantId }),
      this.taskService.countUpcomingLeadFollowUps(),
    ]);

    const conversionRate =
      leadStats.totalLeads > 0 ? Math.round((convertedClients / leadStats.totalLeads) * 1000) / 10 : 0;

    return {
      totalLeads: leadStats.totalLeads,
      activeProposals: leadStats.activeProposals,
      convertedClients,
      archivedClients,
      conversionRate,
      leadsBySource: leadStats.leadsBySource,
      upcomingFollowUps,
    };
  }

  /**
   * PRD §10.5/§10.11 — the Dashboard's "Assigned Clients" widget: resolves the
   * Clients belonging to a given set of Businesses (a staff member's assigned
   * Businesses, from `BusinessAssignmentRepository.findBusinessIdsForUser()` —
   * `DashboardAggregationService` resolves that part; this method only owns the
   * businessIds → Clients lookup, since `ClientRepository` is `crm`-module-internal).
   * An empty `businessIds` array (unassigned staff) returns `[]`, never every
   * tenant Client — see `ClientRepository.findByBusinessIds()`'s own guard.
   */
  async listAssignedClients(businessIds: string[]): Promise<ClientWithBusiness[]> {
    const clients = await this.clientRepository.findByBusinessIds(
      businessIds,
      { tenantId: this.tenantId },
      { business: { select: { id: true, name: true } } },
    );
    return clients as unknown as ClientWithBusiness[];
  }

  /** PRD §10.5 — unrestricted-role count for the "Assigned Clients" widget (every tenant Client, not just the caller's assigned ones). */
  async countAllClients(): Promise<number> {
    const tenantId = this.tenantId as string;
    const [converted, archived] = await Promise.all([
      this.clientRepository.countByStatus([ClientStatus.ACTIVE, ClientStatus.INACTIVE, ClientStatus.SUSPENDED], { tenantId }),
      this.clientRepository.countByStatus([ClientStatus.FORMER], { tenantId }),
    ]);
    return converted + archived;
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

    await this.auditLogRecorder.record({
      tenantId: this.tenantId as string,
      actorId: userId,
      eventType: AuditEventType.LEAD_CONVERTED,
      description: `Converted lead "${lead.title}" into a client`,
      targetType: 'Lead',
      targetId: lead.id,
      ipAddress: this.req.ip ?? null,
    });

    return lead;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Notes (PRD §8.6) — chronological CRM notes, never stored inside Business.
  // ────────────────────────────────────────────────────────────────────────────

  async listLeadNotes(leadId: string): Promise<LeadNote[]> {
    const lead = await this.leadRepository.findById(leadId, { tenantId: this.tenantId });
    this.validateExists(lead, 'Lead');

    return this.leadNoteRepository.findByLead(leadId, { tenantId: this.tenantId });
  }

  async addLeadNote(leadId: string, dto: CreateLeadNoteDto): Promise<LeadNote> {
    const lead = await this.leadRepository.findById(leadId, { tenantId: this.tenantId });
    this.validateExists(lead, 'Lead');

    if (!this.userId) {
      throw new UnauthorizedError();
    }

    this.logger.info({ leadId }, 'Adding lead note');

    // An invalid documentId surfaces as a 409 (P2003 foreign key violation),
    // handled centrally by errorMiddleware — no pre-check needed here.
    const note = await this.leadNoteRepository.create(
      {
        leadId,
        authorId: this.userId,
        content: dto.content,
        documentId: dto.documentId ?? null,
      },
      { tenantId: this.tenantId },
    );

    await this.auditLogRecorder.record({
      tenantId: this.tenantId as string,
      actorId: this.userId,
      eventType: AuditEventType.LEAD_NOTE_ADDED,
      description: `Added a note to lead "${lead.title}"`,
      targetType: 'Lead',
      targetId: leadId,
      ipAddress: this.req.ip ?? null,
    });

    return note;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Staff Assignment (PRD §8.5) — multiple staff per pre-conversion Lead. Once a
  // lead has a linked Business, BusinessAssignment (modules/business) is the
  // equivalent mechanism for post-conversion staff assignment.
  // ────────────────────────────────────────────────────────────────────────────

  async listLeadAssignments(leadId: string): Promise<LeadAssignment[]> {
    const lead = await this.leadRepository.findById(leadId, { tenantId: this.tenantId });
    this.validateExists(lead, 'Lead');

    return this.leadAssignmentRepository.findByLead(leadId, { tenantId: this.tenantId });
  }

  async assignLeadUser(leadId: string, dto: AssignLeadDto): Promise<LeadAssignment> {
    const lead = await this.leadRepository.findById(leadId, { tenantId: this.tenantId });
    this.validateExists(lead, 'Lead');

    const existing = await this.leadAssignmentRepository.findExisting(leadId, dto.userId, { tenantId: this.tenantId });
    if (existing) {
      throw new ConflictError('This user is already assigned to this lead.');
    }

    this.logger.info({ leadId, userId: dto.userId, isPrimary: dto.isPrimary }, 'Assigning user to lead');

    // "Lead owner" (PRD §8.4) — at most one primary assignment per lead, so any
    // existing primary is cleared first, mirroring `convertLead()`'s identical
    // `clearPrimaryForBusiness()` call for `ContactRole.isPrimary`.
    if (dto.isPrimary) {
      await this.leadAssignmentRepository.clearPrimaryForLead(leadId, { tenantId: this.tenantId });
    }

    // An invalid userId surfaces as a 409 (P2003 foreign key violation),
    // handled centrally by errorMiddleware — no pre-check needed here.
    const assignment = await this.leadAssignmentRepository.create(
      { leadId, userId: dto.userId, isPrimary: dto.isPrimary ?? false },
      { tenantId: this.tenantId },
    );

    if (this.userId && this.tenantId) {
      await this.auditLogRecorder.record({
        tenantId: this.tenantId,
        actorId: this.userId,
        eventType: AuditEventType.LEAD_ASSIGNMENT_CHANGED,
        description: `Assigned a staff member to lead "${lead.title}"`,
        targetType: 'Lead',
        targetId: leadId,
        ipAddress: this.req.ip ?? null,
      });
    }

    return assignment;
  }

  async unassignLeadUser(leadId: string, userId: string): Promise<void> {
    const lead = await this.leadRepository.findById(leadId, { tenantId: this.tenantId });
    this.validateExists(lead, 'Lead');

    const existing = await this.leadAssignmentRepository.findExisting(leadId, userId, { tenantId: this.tenantId });
    if (!existing) {
      throw new NotFoundError('Lead assignment');
    }

    this.logger.info({ leadId, userId }, 'Unassigning user from lead');

    await this.leadAssignmentRepository.forceDelete(existing.id, { tenantId: this.tenantId });

    if (this.userId && this.tenantId) {
      await this.auditLogRecorder.record({
        tenantId: this.tenantId,
        actorId: this.userId,
        eventType: AuditEventType.LEAD_ASSIGNMENT_CHANGED,
        description: `Removed a staff assignment from lead "${lead.title}"`,
        targetType: 'Lead',
        targetId: leadId,
        ipAddress: this.req.ip ?? null,
      });
    }
  }
}
