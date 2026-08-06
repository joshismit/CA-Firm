import { Request } from 'express';
import {
  AuditEventType,
  Business,
  Client,
  ClientStatus,
  ContactRole,
  ContactRoleType,
  Lead,
  LeadAssignment,
  LeadConversion,
  LeadNote,
  LeadStage,
} from '@prisma/client';

/**
 * See the identical comment in tests/unit/modules/business/business.service.spec.ts
 * for why @config/database is stubbed, and the identical comment in
 * tests/unit/modules/contacts/contact.service.spec.ts for why `$transaction`
 * needs a working stub here too — `LeadService.convertLead()` wraps its
 * writes in a real `this.transaction()` call, exactly like
 * `ContactService.assignContactRole()`.
 */
jest.mock('@config/database', () => ({
  prisma: { $transaction: jest.fn((operation: (tx: unknown) => unknown) => operation({})) },
}));
import { UserRole } from '@shared/enums';
import { ConflictError, NotFoundError, UnauthorizedError } from '@shared/errors';
import { LeadService } from '@modules/crm/service/lead.service';
import { LeadRepository } from '@modules/crm/repository/lead.repository';
import { LeadStageRepository } from '@modules/crm/repository/lead-stage.repository';
import { LeadConversionRepository } from '@modules/crm/repository/lead-conversion.repository';
import { LeadNoteRepository } from '@modules/crm/repository/lead-note.repository';
import { LeadAssignmentRepository } from '@modules/crm/repository/lead-assignment.repository';
import { ClientRepository } from '@modules/crm/repository/client.repository';
import { ContactRoleRepository } from '@modules/contacts';
import { BusinessService } from '@modules/business';
import { AuditLogRecorder, AuditTimelineReader } from '@modules/audit';
import { TaskService } from '@modules/tasks';
import {
  AssignLeadDto,
  ConvertLeadDto,
  CreateLeadDto,
  CreateLeadNoteDto,
  ListLeadsQueryDto,
  RespondProposalDto,
  SendProposalDto,
  UpdateLeadDto,
} from '@modules/crm/dto/lead.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * LeadService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every repository (and `BusinessService`) is fully mocked — these tests
 * exercise only the business logic in `LeadService` (existence guards,
 * conversion pre-checks, transaction wiring, DTO → repository mapping),
 * never a real database. Mocks are injected via the service's constructor
 * DI parameters, exactly as designed for this. Mirrors
 * `tests/unit/modules/contacts/contact.service.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';
const BUSINESS_ID = 'business-66666666-6666-6666-6666-666666666666';
const CONTACT_ID = 'contact-77777777-7777-7777-7777-777777777777';
const SOURCE_ID = 'source-88888888-8888-8888-8888-888888888888';
const STAGE_ID = 'stage-99999999-9999-9999-9999-999999999999';
const CLIENT_ID = 'client-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

type MockedLeadRepository = {
  [K in 'findById' | 'create' | 'update' | 'delete' | 'search' | 'getDashboardStats']: jest.Mock;
};
type MockedLeadStageRepository = { [K in 'listAll']: jest.Mock };
type MockedLeadConversionRepository = { [K in 'findByLead' | 'create']: jest.Mock };
type MockedClientRepository = { [K in 'findByBusiness' | 'create' | 'countByStatus']: jest.Mock };
type MockedContactRoleRepository = {
  [K in 'findExisting' | 'clearPrimaryForBusiness' | 'create']: jest.Mock;
};
type MockedBusinessService = { [K in 'getBusinessById']: jest.Mock };
type MockedAuditLogRecorder = { record: jest.Mock };
type MockedAuditTimelineReader = { getTimeline: jest.Mock };
type MockedTaskService = { countUpcomingLeadFollowUps: jest.Mock };
type MockedLeadNoteRepository = { [K in 'findByLead' | 'findMostRecentByLead' | 'create']: jest.Mock };
type MockedLeadAssignmentRepository = {
  [K in 'findByLead' | 'findExisting' | 'create' | 'forceDelete' | 'clearPrimaryForLead']: jest.Mock;
};

function createMockLeadRepository(): MockedLeadRepository {
  return {
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    search: jest.fn(),
    getDashboardStats: jest.fn(),
  };
}
function createMockLeadStageRepository(): MockedLeadStageRepository {
  return { listAll: jest.fn() };
}
function createMockLeadConversionRepository(): MockedLeadConversionRepository {
  return { findByLead: jest.fn(), create: jest.fn() };
}
function createMockClientRepository(): MockedClientRepository {
  return { findByBusiness: jest.fn(), create: jest.fn(), countByStatus: jest.fn() };
}
function createMockContactRoleRepository(): MockedContactRoleRepository {
  return { findExisting: jest.fn(), clearPrimaryForBusiness: jest.fn(), create: jest.fn() };
}
function createMockBusinessService(): MockedBusinessService {
  return { getBusinessById: jest.fn() };
}
function createMockAuditLogRecorder(): MockedAuditLogRecorder {
  return { record: jest.fn().mockResolvedValue(undefined) };
}
function createMockAuditTimelineReader(): MockedAuditTimelineReader {
  return { getTimeline: jest.fn() };
}
function createMockTaskService(): MockedTaskService {
  return { countUpcomingLeadFollowUps: jest.fn() };
}
function createMockLeadNoteRepository(): MockedLeadNoteRepository {
  return { findByLead: jest.fn(), findMostRecentByLead: jest.fn(), create: jest.fn() };
}
function createMockLeadAssignmentRepository(): MockedLeadAssignmentRepository {
  return {
    findByLead: jest.fn(),
    findExisting: jest.fn(),
    create: jest.fn(),
    forceDelete: jest.fn(),
    clearPrimaryForLead: jest.fn(),
  };
}

function createFakeRequest(): Request {
  return {
    tenant: { id: TENANT_ID, slug: 'acme', name: 'Acme & Co', planCode: 'professional', isActive: true },
    user: { id: USER_ID, email: 'manager@acme.test', role: UserRole.TENANT_ADMIN, tenantId: TENANT_ID, permissions: [] },
    correlationId: 'test-correlation-id',
  } as unknown as Request;
}

function createFakeRequestNoUser(): Request {
  return {
    tenant: { id: TENANT_ID, slug: 'acme', name: 'Acme & Co', planCode: 'professional', isActive: true },
    user: undefined,
    correlationId: 'test-correlation-id',
  } as unknown as Request;
}

function createMockLead(overrides: Partial<Lead> = {}): Lead {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'lead-33333333-3333-3333-3333-333333333333',
    tenantId: TENANT_ID,
    businessId: null,
    contactId: null,
    title: 'Acme Corp — GST Advisory',
    sourceId: SOURCE_ID,
    stageId: STAGE_ID,
    priority: null,
    expectedRevenue: null,
    probability: null,
    expectedCloseDate: null,
    interestedServices: [],
    proposalSentAt: null,
    proposalAcceptedAt: null,
    proposalRejectedAt: null,
    proposalValue: null,
    proposalRemarks: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  };
}

function createMockLeadStage(overrides: Partial<LeadStage> = {}): LeadStage {
  return { id: STAGE_ID, tenantId: TENANT_ID, name: 'Proposal', order: 2, ...overrides };
}

function createMockClient(overrides: Partial<Client> = {}): Client {
  return {
    id: CLIENT_ID,
    tenantId: TENANT_ID,
    businessId: BUSINESS_ID,
    status: ClientStatus.ACTIVE,
    onboardedAt: null,
    categoryId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

function createMockContactRole(overrides: Partial<ContactRole> = {}): ContactRole {
  return {
    id: 'role-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    tenantId: TENANT_ID,
    businessId: BUSINESS_ID,
    contactId: CONTACT_ID,
    roleType: ContactRoleType.CLIENT_REPRESENTATIVE,
    customTitle: null,
    isPrimary: true,
    sharePercent: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createMockLeadConversion(overrides: Partial<LeadConversion> = {}): LeadConversion {
  return {
    id: 'conversion-cccccccc-cccc-cccc-cccc-cccccccccccc',
    tenantId: TENANT_ID,
    leadId: 'lead-33333333-3333-3333-3333-333333333333',
    clientId: CLIENT_ID,
    convertedById: USER_ID,
    convertedAt: new Date('2026-01-01T00:00:00.000Z'),
    notes: null,
    ...overrides,
  };
}

function createMockBusiness(overrides: Partial<Business> = {}): Business {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: BUSINESS_ID,
    tenantId: TENANT_ID,
    typeId: 'type-dddddddd-dddd-dddd-dddd-dddddddddddd',
    name: 'Acme Manufacturing Pvt Ltd',
    legalName: null,
    status: 'ACTIVE',
    pan: null,
    gstin: null,
    cin: null,
    incorporationDate: null,
    financialYearStart: 4,
    industry: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdBy: null,
    deletedBy: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(overrides as any),
  } as Business;
}

interface ServiceMocks {
  leadRepository: MockedLeadRepository;
  leadStageRepository: MockedLeadStageRepository;
  leadConversionRepository: MockedLeadConversionRepository;
  clientRepository: MockedClientRepository;
  contactRoleRepository: MockedContactRoleRepository;
  businessService: MockedBusinessService;
  auditLogRecorder: MockedAuditLogRecorder;
  leadNoteRepository: MockedLeadNoteRepository;
  leadAssignmentRepository: MockedLeadAssignmentRepository;
  auditTimelineReader: MockedAuditTimelineReader;
  taskService: MockedTaskService;
}

function createMocks(): ServiceMocks {
  return {
    leadRepository: createMockLeadRepository(),
    leadStageRepository: createMockLeadStageRepository(),
    leadConversionRepository: createMockLeadConversionRepository(),
    clientRepository: createMockClientRepository(),
    contactRoleRepository: createMockContactRoleRepository(),
    businessService: createMockBusinessService(),
    auditLogRecorder: createMockAuditLogRecorder(),
    leadNoteRepository: createMockLeadNoteRepository(),
    leadAssignmentRepository: createMockLeadAssignmentRepository(),
    auditTimelineReader: createMockAuditTimelineReader(),
    taskService: createMockTaskService(),
  };
}

function createService(mocks: ServiceMocks, req: Request = createFakeRequest()): LeadService {
  return new LeadService(
    req,
    mocks.leadRepository as unknown as LeadRepository,
    mocks.leadStageRepository as unknown as LeadStageRepository,
    mocks.leadConversionRepository as unknown as LeadConversionRepository,
    mocks.clientRepository as unknown as ClientRepository,
    mocks.contactRoleRepository as unknown as ContactRoleRepository,
    mocks.businessService as unknown as BusinessService,
    mocks.auditLogRecorder as unknown as AuditLogRecorder,
    mocks.leadNoteRepository as unknown as LeadNoteRepository,
    mocks.leadAssignmentRepository as unknown as LeadAssignmentRepository,
    mocks.auditTimelineReader as unknown as AuditTimelineReader,
    mocks.taskService as unknown as TaskService,
  );
}

function createMockLeadNote(overrides: Partial<LeadNote> = {}): LeadNote {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'note-eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    tenantId: TENANT_ID,
    leadId: 'lead-33333333-3333-3333-3333-333333333333',
    content: 'Spoke with the client, following up next week.',
    authorId: USER_ID,
    documentId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createMockLeadAssignment(overrides: Partial<LeadAssignment> = {}): LeadAssignment {
  return {
    id: 'assignment-ffffffff-ffff-ffff-ffff-ffffffffffff',
    tenantId: TENANT_ID,
    leadId: 'lead-33333333-3333-3333-3333-333333333333',
    userId: USER_ID,
    isPrimary: false,
    assignedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('LeadService', () => {
  // ────────────────────────────────────────────────────────────────────────
  // createLead
  // ────────────────────────────────────────────────────────────────────────
  describe('createLead', () => {
    const dto: CreateLeadDto = {
      title: 'Acme Corp — GST Advisory',
      sourceId: SOURCE_ID,
      stageId: STAGE_ID,
    };

    it('creates a lead, nulling every omitted optional field', async () => {
      const mocks = createMocks();
      const created = createMockLead();
      mocks.leadRepository.create.mockResolvedValue(created);

      const service = createService(mocks);
      const result = await service.createLead(dto);

      expect(mocks.leadRepository.create).toHaveBeenCalledWith(
        {
          businessId: null,
          contactId: null,
          title: dto.title,
          sourceId: dto.sourceId,
          stageId: dto.stageId,
          priority: null,
          expectedRevenue: null,
          probability: null,
          expectedCloseDate: null,
          interestedServices: [],
        },
        { tenantId: TENANT_ID },
      );
      expect(result).toBe(created);
    });

    it('passes through explicit optional fields instead of defaulting them', async () => {
      const mocks = createMocks();
      const fullDto: CreateLeadDto = {
        businessId: BUSINESS_ID,
        contactId: CONTACT_ID,
        title: 'Acme Corp — GST Advisory',
        sourceId: SOURCE_ID,
        stageId: STAGE_ID,
        expectedRevenue: 50000,
        probability: 60,
        expectedCloseDate: new Date('2026-03-01'),
      };
      mocks.leadRepository.create.mockResolvedValue(createMockLead());

      const service = createService(mocks);
      await service.createLead(fullDto);

      expect(mocks.leadRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: BUSINESS_ID,
          contactId: CONTACT_ID,
          expectedRevenue: 50000,
          probability: 60,
          expectedCloseDate: fullDto.expectedCloseDate,
        }),
        { tenantId: TENANT_ID },
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // updateLead
  // ────────────────────────────────────────────────────────────────────────
  describe('updateLead', () => {
    it('throws NotFoundError when the lead does not exist', async () => {
      const mocks = createMocks();
      mocks.leadRepository.findById.mockResolvedValue(null);

      const service = createService(mocks);
      const dto: UpdateLeadDto = { title: 'Renamed' };

      await expect(service.updateLead('missing-id', dto)).rejects.toThrow(NotFoundError);
      expect(mocks.leadRepository.update).not.toHaveBeenCalled();
    });

    it('updates the lead when it exists', async () => {
      const mocks = createMocks();
      mocks.leadRepository.findById.mockResolvedValue(createMockLead());
      const updated = createMockLead({ title: 'Acme Corp — GST Advisory (renamed)' });
      mocks.leadRepository.update.mockResolvedValue(updated);

      const service = createService(mocks);
      const dto: UpdateLeadDto = { title: 'Acme Corp — GST Advisory (renamed)' };
      const result = await service.updateLead('lead-1', dto);

      expect(mocks.leadRepository.update).toHaveBeenCalledWith('lead-1', dto, { tenantId: TENANT_ID });
      expect(result).toBe(updated);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // deleteLead
  // ────────────────────────────────────────────────────────────────────────
  describe('deleteLead', () => {
    it('throws NotFoundError when the lead does not exist', async () => {
      const mocks = createMocks();
      mocks.leadRepository.findById.mockResolvedValue(null);

      const service = createService(mocks);

      await expect(service.deleteLead('missing-id')).rejects.toThrow(NotFoundError);
      expect(mocks.leadRepository.delete).not.toHaveBeenCalled();
    });

    it('soft-deletes an existing lead, passing userId (Lead has a deletedBy column, unlike Contact)', async () => {
      const mocks = createMocks();
      mocks.leadRepository.findById.mockResolvedValue(createMockLead());
      mocks.leadRepository.delete.mockResolvedValue(true);

      const service = createService(mocks);
      await service.deleteLead('lead-1');

      expect(mocks.leadRepository.delete).toHaveBeenCalledWith('lead-1', { tenantId: TENANT_ID, userId: USER_ID });
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // getLeadById / listLeads / listStages
  // ────────────────────────────────────────────────────────────────────────
  describe('getLeadById', () => {
    it('returns the lead when found', async () => {
      const mocks = createMocks();
      const lead = createMockLead();
      mocks.leadRepository.findById.mockResolvedValue(lead);

      const service = createService(mocks);
      const result = await service.getLeadById(lead.id);

      expect(mocks.leadRepository.findById).toHaveBeenCalledWith(lead.id, { tenantId: TENANT_ID });
      expect(result).toBe(lead);
    });

    it('throws NotFoundError when no lead matches the ID', async () => {
      const mocks = createMocks();
      mocks.leadRepository.findById.mockResolvedValue(null);

      const service = createService(mocks);

      await expect(service.getLeadById('missing-id')).rejects.toThrow(NotFoundError);
    });
  });

  describe('listLeads', () => {
    it('delegates to repository.search with the filters and pagination mapped from the query', async () => {
      const mocks = createMocks();
      const leads = [createMockLead(), createMockLead({ id: 'lead-2' })];
      const paginated = {
        data: leads,
        meta: { page: 1, limit: 20, total: 2, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      };
      mocks.leadRepository.search.mockResolvedValue(paginated);

      const service = createService(mocks);
      const query: ListLeadsQueryDto = {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        search: 'gst',
        stageId: STAGE_ID,
        sourceId: SOURCE_ID,
      };

      const result = await service.listLeads(query);

      expect(mocks.leadRepository.search).toHaveBeenCalledWith(
        { stageId: STAGE_ID, sourceId: SOURCE_ID, search: 'gst' },
        { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
        { tenantId: TENANT_ID },
      );
      expect(result).toBe(paginated);
    });
  });

  describe('listStages', () => {
    it('delegates to leadStageRepository.listAll', async () => {
      const mocks = createMocks();
      const stages = [createMockLeadStage()];
      mocks.leadStageRepository.listAll.mockResolvedValue(stages);

      const service = createService(mocks);
      const result = await service.listStages();

      expect(mocks.leadStageRepository.listAll).toHaveBeenCalledWith({ tenantId: TENANT_ID });
      expect(result).toBe(stages);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // convertLead
  // ────────────────────────────────────────────────────────────────────────
  describe('convertLead', () => {
    const dto: ConvertLeadDto = { notes: 'Converted after successful proposal.' };

    it('throws UnauthorizedError when the request has no authenticated user', async () => {
      const mocks = createMocks();
      const service = createService(mocks, createFakeRequestNoUser());

      await expect(service.convertLead('lead-1', dto)).rejects.toThrow(UnauthorizedError);
      expect(mocks.leadRepository.findById).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when the lead does not exist', async () => {
      const mocks = createMocks();
      mocks.leadRepository.findById.mockResolvedValue(null);

      const service = createService(mocks);

      await expect(service.convertLead('missing-id', dto)).rejects.toThrow(NotFoundError);
    });

    it('throws ConflictError when the lead has already been converted (duplicate conversion prevention)', async () => {
      const mocks = createMocks();
      mocks.leadRepository.findById.mockResolvedValue(createMockLead({ businessId: BUSINESS_ID }));
      mocks.leadConversionRepository.findByLead.mockResolvedValue(createMockLeadConversion());

      const service = createService(mocks);

      await expect(service.convertLead('lead-1', dto)).rejects.toThrow(ConflictError);
      expect(mocks.businessService.getBusinessById).not.toHaveBeenCalled();
      expect(mocks.clientRepository.create).not.toHaveBeenCalled();
    });

    it('throws ConflictError when the lead has no linked business', async () => {
      const mocks = createMocks();
      mocks.leadRepository.findById.mockResolvedValue(createMockLead({ businessId: null }));
      mocks.leadConversionRepository.findByLead.mockResolvedValue(null);

      const service = createService(mocks);

      await expect(service.convertLead('lead-1', dto)).rejects.toThrow(ConflictError);
      expect(mocks.businessService.getBusinessById).not.toHaveBeenCalled();
    });

    it('propagates NotFoundError when the linked business no longer exists (LeadStage/Business validation)', async () => {
      const mocks = createMocks();
      mocks.leadRepository.findById.mockResolvedValue(createMockLead({ businessId: BUSINESS_ID }));
      mocks.leadConversionRepository.findByLead.mockResolvedValue(null);
      mocks.businessService.getBusinessById.mockRejectedValue(new NotFoundError('Business'));

      const service = createService(mocks);

      await expect(service.convertLead('lead-1', dto)).rejects.toThrow(NotFoundError);
      expect(mocks.businessService.getBusinessById).toHaveBeenCalledWith(BUSINESS_ID);
      // The transaction never opens if business validation fails.
      expect(mocks.clientRepository.create).not.toHaveBeenCalled();
    });

    it('creates a new Client when none exists yet for the business', async () => {
      const mocks = createMocks();
      const lead = createMockLead({ businessId: BUSINESS_ID, contactId: null });
      mocks.leadRepository.findById.mockResolvedValue(lead);
      mocks.leadConversionRepository.findByLead.mockResolvedValue(null);
      mocks.businessService.getBusinessById.mockResolvedValue(createMockBusiness());
      mocks.clientRepository.findByBusiness.mockResolvedValue(null);
      const newClient = createMockClient();
      mocks.clientRepository.create.mockResolvedValue(newClient);
      mocks.leadConversionRepository.create.mockResolvedValue(createMockLeadConversion());

      const service = createService(mocks);
      const result = await service.convertLead(lead.id, dto);

      expect(mocks.clientRepository.create).toHaveBeenCalledWith(
        { businessId: BUSINESS_ID, status: ClientStatus.ACTIVE },
        { tenantId: TENANT_ID, tx: {} },
      );
      expect(result).toBe(lead);
    });

    it('reuses the existing Client instead of creating a duplicate (Client.businessId is unique)', async () => {
      const mocks = createMocks();
      const lead = createMockLead({ businessId: BUSINESS_ID, contactId: null });
      mocks.leadRepository.findById.mockResolvedValue(lead);
      mocks.leadConversionRepository.findByLead.mockResolvedValue(null);
      mocks.businessService.getBusinessById.mockResolvedValue(createMockBusiness());
      const existingClient = createMockClient();
      mocks.clientRepository.findByBusiness.mockResolvedValue(existingClient);
      mocks.leadConversionRepository.create.mockResolvedValue(createMockLeadConversion());

      const service = createService(mocks);
      await service.convertLead(lead.id, dto);

      expect(mocks.clientRepository.create).not.toHaveBeenCalled();
      expect(mocks.leadConversionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: existingClient.id }),
        { tenantId: TENANT_ID, tx: {} },
      );
    });

    it('skips the ContactRole step entirely when the lead has no linked contact', async () => {
      const mocks = createMocks();
      const lead = createMockLead({ businessId: BUSINESS_ID, contactId: null });
      mocks.leadRepository.findById.mockResolvedValue(lead);
      mocks.leadConversionRepository.findByLead.mockResolvedValue(null);
      mocks.businessService.getBusinessById.mockResolvedValue(createMockBusiness());
      mocks.clientRepository.findByBusiness.mockResolvedValue(createMockClient());
      mocks.leadConversionRepository.create.mockResolvedValue(createMockLeadConversion());

      const service = createService(mocks);
      await service.convertLead(lead.id, dto);

      expect(mocks.contactRoleRepository.findExisting).not.toHaveBeenCalled();
      expect(mocks.contactRoleRepository.clearPrimaryForBusiness).not.toHaveBeenCalled();
      expect(mocks.contactRoleRepository.create).not.toHaveBeenCalled();
    });

    it('creates a primary CLIENT_REPRESENTATIVE ContactRole when the lead has a contact and no existing role (ContactRole assignment)', async () => {
      const mocks = createMocks();
      const lead = createMockLead({ businessId: BUSINESS_ID, contactId: CONTACT_ID });
      mocks.leadRepository.findById.mockResolvedValue(lead);
      mocks.leadConversionRepository.findByLead.mockResolvedValue(null);
      mocks.businessService.getBusinessById.mockResolvedValue(createMockBusiness());
      mocks.clientRepository.findByBusiness.mockResolvedValue(createMockClient());
      mocks.contactRoleRepository.findExisting.mockResolvedValue(null);
      mocks.leadConversionRepository.create.mockResolvedValue(createMockLeadConversion());

      const service = createService(mocks);
      await service.convertLead(lead.id, dto);

      expect(mocks.contactRoleRepository.findExisting).toHaveBeenCalledWith(
        BUSINESS_ID,
        CONTACT_ID,
        ContactRoleType.CLIENT_REPRESENTATIVE,
        { tenantId: TENANT_ID, tx: {} },
      );
      expect(mocks.contactRoleRepository.clearPrimaryForBusiness).toHaveBeenCalledWith(BUSINESS_ID, {
        tenantId: TENANT_ID,
        tx: {},
      });
      expect(mocks.contactRoleRepository.create).toHaveBeenCalledWith(
        {
          businessId: BUSINESS_ID,
          contactId: CONTACT_ID,
          roleType: ContactRoleType.CLIENT_REPRESENTATIVE,
          customTitle: null,
          isPrimary: true,
          sharePercent: null,
        },
        { tenantId: TENANT_ID, tx: {} },
      );
    });

    it('does not create a duplicate ContactRole when one already exists for this (business, contact, roleType)', async () => {
      const mocks = createMocks();
      const lead = createMockLead({ businessId: BUSINESS_ID, contactId: CONTACT_ID });
      mocks.leadRepository.findById.mockResolvedValue(lead);
      mocks.leadConversionRepository.findByLead.mockResolvedValue(null);
      mocks.businessService.getBusinessById.mockResolvedValue(createMockBusiness());
      mocks.clientRepository.findByBusiness.mockResolvedValue(createMockClient());
      mocks.contactRoleRepository.findExisting.mockResolvedValue(createMockContactRole());
      mocks.leadConversionRepository.create.mockResolvedValue(createMockLeadConversion());

      const service = createService(mocks);
      await service.convertLead(lead.id, dto);

      expect(mocks.contactRoleRepository.clearPrimaryForBusiness).not.toHaveBeenCalled();
      expect(mocks.contactRoleRepository.create).not.toHaveBeenCalled();
    });

    it('creates the LeadConversion with leadId/clientId/convertedById/notes and returns the original lead', async () => {
      const mocks = createMocks();
      const lead = createMockLead({ businessId: BUSINESS_ID, contactId: null });
      mocks.leadRepository.findById.mockResolvedValue(lead);
      mocks.leadConversionRepository.findByLead.mockResolvedValue(null);
      mocks.businessService.getBusinessById.mockResolvedValue(createMockBusiness());
      const client = createMockClient();
      mocks.clientRepository.findByBusiness.mockResolvedValue(client);
      mocks.leadConversionRepository.create.mockResolvedValue(createMockLeadConversion());

      const service = createService(mocks);
      const result = await service.convertLead(lead.id, dto);

      expect(mocks.leadConversionRepository.create).toHaveBeenCalledWith(
        { leadId: lead.id, clientId: client.id, convertedById: USER_ID, notes: dto.notes },
        { tenantId: TENANT_ID, tx: {} },
      );
      expect(result).toBe(lead);
    });

    it('defaults notes to null when not provided', async () => {
      const mocks = createMocks();
      const lead = createMockLead({ businessId: BUSINESS_ID, contactId: null });
      mocks.leadRepository.findById.mockResolvedValue(lead);
      mocks.leadConversionRepository.findByLead.mockResolvedValue(null);
      mocks.businessService.getBusinessById.mockResolvedValue(createMockBusiness());
      mocks.clientRepository.findByBusiness.mockResolvedValue(createMockClient());
      mocks.leadConversionRepository.create.mockResolvedValue(createMockLeadConversion());

      const service = createService(mocks);
      await service.convertLead(lead.id, {});

      expect(mocks.leadConversionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ notes: null }),
        { tenantId: TENANT_ID, tx: {} },
      );
    });

    it('every write in the conversion shares the same transaction client (atomic — Client/ContactRole/LeadConversion all commit or none do)', async () => {
      const mocks = createMocks();
      const lead = createMockLead({ businessId: BUSINESS_ID, contactId: CONTACT_ID });
      mocks.leadRepository.findById.mockResolvedValue(lead);
      mocks.leadConversionRepository.findByLead.mockResolvedValue(null);
      mocks.businessService.getBusinessById.mockResolvedValue(createMockBusiness());
      mocks.clientRepository.findByBusiness.mockResolvedValue(null);
      mocks.clientRepository.create.mockResolvedValue(createMockClient());
      mocks.contactRoleRepository.findExisting.mockResolvedValue(null);
      mocks.leadConversionRepository.create.mockResolvedValue(createMockLeadConversion());

      const service = createService(mocks);
      await service.convertLead(lead.id, dto);

      const sharedTx = {};
      const calls = [
        mocks.clientRepository.create.mock.calls[0][1],
        mocks.contactRoleRepository.clearPrimaryForBusiness.mock.calls[0][1],
        mocks.contactRoleRepository.create.mock.calls[0][1],
        mocks.leadConversionRepository.create.mock.calls[0][1],
      ];
      for (const options of calls) {
        expect(options.tx).toEqual(sharedTx);
      }
    });

    it('rolls back (propagates the error, performs no post-transaction work) when the final LeadConversion insert fails', async () => {
      const mocks = createMocks();
      const lead = createMockLead({ businessId: BUSINESS_ID, contactId: null });
      mocks.leadRepository.findById.mockResolvedValue(lead);
      mocks.leadConversionRepository.findByLead.mockResolvedValue(null);
      mocks.businessService.getBusinessById.mockResolvedValue(createMockBusiness());
      mocks.clientRepository.findByBusiness.mockResolvedValue(createMockClient());
      // Simulates the real P2002 unique-constraint failure on LeadConversion.clientId
      // (e.g. a concurrent conversion for the same business already committed).
      const dbError = new Error('Unique constraint failed on the fields: (`client_id`)');
      mocks.leadConversionRepository.create.mockRejectedValue(dbError);

      const service = createService(mocks);

      await expect(service.convertLead(lead.id, dto)).rejects.toThrow(dbError);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Audit (PRD §8.11)
  // ────────────────────────────────────────────────────────────────────────
  describe('audit logging', () => {
    it('records LEAD_CREATED on createLead', async () => {
      const mocks = createMocks();
      mocks.leadRepository.create.mockResolvedValue(createMockLead());

      const service = createService(mocks);
      await service.createLead({ title: 'Acme Corp — GST Advisory', sourceId: SOURCE_ID, stageId: STAGE_ID });

      expect(mocks.auditLogRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: AuditEventType.LEAD_CREATED, targetType: 'Lead' }),
      );
    });

    it('records LEAD_STAGE_CHANGED on updateLead only when stageId actually changes', async () => {
      const mocks = createMocks();
      const existing = createMockLead({ stageId: STAGE_ID });
      mocks.leadRepository.findById.mockResolvedValue(existing);
      mocks.leadRepository.update.mockResolvedValue(createMockLead({ stageId: 'stage-changed' }));

      const service = createService(mocks);
      await service.updateLead(existing.id, { stageId: 'stage-changed' });

      expect(mocks.auditLogRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: AuditEventType.LEAD_STAGE_CHANGED }),
      );
    });

    it('does not record LEAD_STAGE_CHANGED when updateLead leaves stageId untouched', async () => {
      const mocks = createMocks();
      const existing = createMockLead({ stageId: STAGE_ID });
      mocks.leadRepository.findById.mockResolvedValue(existing);
      mocks.leadRepository.update.mockResolvedValue(existing);

      const service = createService(mocks);
      await service.updateLead(existing.id, { title: 'Renamed only' });

      expect(mocks.auditLogRecorder.record).not.toHaveBeenCalled();
    });

    it('records LEAD_CONVERTED on convertLead', async () => {
      const mocks = createMocks();
      const lead = createMockLead({ businessId: BUSINESS_ID, contactId: null });
      mocks.leadRepository.findById.mockResolvedValue(lead);
      mocks.leadConversionRepository.findByLead.mockResolvedValue(null);
      mocks.businessService.getBusinessById.mockResolvedValue(createMockBusiness());
      mocks.clientRepository.findByBusiness.mockResolvedValue(createMockClient());
      mocks.leadConversionRepository.create.mockResolvedValue(createMockLeadConversion());

      const service = createService(mocks);
      await service.convertLead(lead.id, { notes: 'done' });

      expect(mocks.auditLogRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: AuditEventType.LEAD_CONVERTED, targetType: 'Lead', targetId: lead.id }),
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Notes (PRD §8.6) — chronological CRM notes, never stored inside Business.
  // ────────────────────────────────────────────────────────────────────────
  describe('listLeadNotes', () => {
    it('throws NotFoundError when the lead does not exist', async () => {
      const mocks = createMocks();
      mocks.leadRepository.findById.mockResolvedValue(null);

      const service = createService(mocks);

      await expect(service.listLeadNotes('missing-id')).rejects.toThrow(NotFoundError);
      expect(mocks.leadNoteRepository.findByLead).not.toHaveBeenCalled();
    });

    it('returns the lead notes, newest first', async () => {
      const mocks = createMocks();
      mocks.leadRepository.findById.mockResolvedValue(createMockLead());
      const notes = [createMockLeadNote(), createMockLeadNote({ id: 'note-2' })];
      mocks.leadNoteRepository.findByLead.mockResolvedValue(notes);

      const service = createService(mocks);
      const result = await service.listLeadNotes('lead-33333333-3333-3333-3333-333333333333');

      expect(mocks.leadNoteRepository.findByLead).toHaveBeenCalledWith(
        'lead-33333333-3333-3333-3333-333333333333',
        { tenantId: TENANT_ID },
      );
      expect(result).toBe(notes);
    });
  });

  describe('addLeadNote', () => {
    const dto: CreateLeadNoteDto = { content: 'Spoke with the client.' };

    it('throws NotFoundError when the lead does not exist', async () => {
      const mocks = createMocks();
      mocks.leadRepository.findById.mockResolvedValue(null);

      const service = createService(mocks);

      await expect(service.addLeadNote('missing-id', dto)).rejects.toThrow(NotFoundError);
      expect(mocks.leadNoteRepository.create).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedError when the request has no authenticated user', async () => {
      const mocks = createMocks();
      mocks.leadRepository.findById.mockResolvedValue(createMockLead());

      const service = createService(mocks, createFakeRequestNoUser());

      await expect(service.addLeadNote('lead-1', dto)).rejects.toThrow(UnauthorizedError);
    });

    it('creates the note stamped with the authenticated user as author, and records LEAD_NOTE_ADDED', async () => {
      const mocks = createMocks();
      const lead = createMockLead();
      mocks.leadRepository.findById.mockResolvedValue(lead);
      const note = createMockLeadNote({ leadId: lead.id });
      mocks.leadNoteRepository.create.mockResolvedValue(note);

      const service = createService(mocks);
      const result = await service.addLeadNote(lead.id, dto);

      expect(mocks.leadNoteRepository.create).toHaveBeenCalledWith(
        { leadId: lead.id, authorId: USER_ID, content: dto.content, documentId: null },
        { tenantId: TENANT_ID },
      );
      expect(mocks.auditLogRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: AuditEventType.LEAD_NOTE_ADDED, targetType: 'Lead', targetId: lead.id }),
      );
      expect(result).toBe(note);
    });

    it('passes through an optional documentId attachment reference', async () => {
      const mocks = createMocks();
      mocks.leadRepository.findById.mockResolvedValue(createMockLead());
      mocks.leadNoteRepository.create.mockResolvedValue(createMockLeadNote());

      const service = createService(mocks);
      await service.addLeadNote('lead-1', { content: 'See attached.', documentId: 'document-1' });

      expect(mocks.leadNoteRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ documentId: 'document-1' }),
        { tenantId: TENANT_ID },
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Staff Assignment (PRD §8.5)
  // ────────────────────────────────────────────────────────────────────────
  describe('listLeadAssignments', () => {
    it('throws NotFoundError when the lead does not exist', async () => {
      const mocks = createMocks();
      mocks.leadRepository.findById.mockResolvedValue(null);

      const service = createService(mocks);

      await expect(service.listLeadAssignments('missing-id')).rejects.toThrow(NotFoundError);
    });

    it('returns the lead assignments', async () => {
      const mocks = createMocks();
      mocks.leadRepository.findById.mockResolvedValue(createMockLead());
      const assignments = [createMockLeadAssignment()];
      mocks.leadAssignmentRepository.findByLead.mockResolvedValue(assignments);

      const service = createService(mocks);
      const result = await service.listLeadAssignments('lead-33333333-3333-3333-3333-333333333333');

      expect(result).toBe(assignments);
    });
  });

  describe('assignLeadUser', () => {
    const dto: AssignLeadDto = { userId: 'staff-user-1' };

    it('throws NotFoundError when the lead does not exist', async () => {
      const mocks = createMocks();
      mocks.leadRepository.findById.mockResolvedValue(null);

      const service = createService(mocks);

      await expect(service.assignLeadUser('missing-id', dto)).rejects.toThrow(NotFoundError);
      expect(mocks.leadAssignmentRepository.create).not.toHaveBeenCalled();
    });

    it('throws ConflictError when the user is already assigned to this lead', async () => {
      const mocks = createMocks();
      mocks.leadRepository.findById.mockResolvedValue(createMockLead());
      mocks.leadAssignmentRepository.findExisting.mockResolvedValue(createMockLeadAssignment());

      const service = createService(mocks);

      await expect(service.assignLeadUser('lead-1', dto)).rejects.toThrow(ConflictError);
      expect(mocks.leadAssignmentRepository.create).not.toHaveBeenCalled();
    });

    it('creates the assignment and records LEAD_ASSIGNMENT_CHANGED', async () => {
      const mocks = createMocks();
      const lead = createMockLead();
      mocks.leadRepository.findById.mockResolvedValue(lead);
      mocks.leadAssignmentRepository.findExisting.mockResolvedValue(null);
      const assignment = createMockLeadAssignment({ leadId: lead.id, userId: dto.userId });
      mocks.leadAssignmentRepository.create.mockResolvedValue(assignment);

      const service = createService(mocks);
      const result = await service.assignLeadUser(lead.id, dto);

      expect(mocks.leadAssignmentRepository.create).toHaveBeenCalledWith(
        { leadId: lead.id, userId: dto.userId, isPrimary: false },
        { tenantId: TENANT_ID },
      );
      expect(mocks.auditLogRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: AuditEventType.LEAD_ASSIGNMENT_CHANGED }),
      );
      expect(result).toBe(assignment);
    });

    it('clears any existing primary assignment first, then creates as primary, when isPrimary is true ("lead owner", PRD §8.4)', async () => {
      const mocks = createMocks();
      const lead = createMockLead();
      mocks.leadRepository.findById.mockResolvedValue(lead);
      mocks.leadAssignmentRepository.findExisting.mockResolvedValue(null);
      const primaryDto: AssignLeadDto = { userId: 'staff-user-2', isPrimary: true };
      const assignment = createMockLeadAssignment({ leadId: lead.id, userId: primaryDto.userId, isPrimary: true });
      mocks.leadAssignmentRepository.create.mockResolvedValue(assignment);

      const service = createService(mocks);
      const result = await service.assignLeadUser(lead.id, primaryDto);

      expect(mocks.leadAssignmentRepository.clearPrimaryForLead).toHaveBeenCalledWith(lead.id, { tenantId: TENANT_ID });
      expect(mocks.leadAssignmentRepository.create).toHaveBeenCalledWith(
        { leadId: lead.id, userId: primaryDto.userId, isPrimary: true },
        { tenantId: TENANT_ID },
      );
      expect(result).toBe(assignment);
    });

    it('does not touch existing primaries when isPrimary is omitted', async () => {
      const mocks = createMocks();
      const lead = createMockLead();
      mocks.leadRepository.findById.mockResolvedValue(lead);
      mocks.leadAssignmentRepository.findExisting.mockResolvedValue(null);
      mocks.leadAssignmentRepository.create.mockResolvedValue(createMockLeadAssignment());

      const service = createService(mocks);
      await service.assignLeadUser(lead.id, dto);

      expect(mocks.leadAssignmentRepository.clearPrimaryForLead).not.toHaveBeenCalled();
    });
  });

  describe('unassignLeadUser', () => {
    it('throws NotFoundError when the lead does not exist', async () => {
      const mocks = createMocks();
      mocks.leadRepository.findById.mockResolvedValue(null);

      const service = createService(mocks);

      await expect(service.unassignLeadUser('missing-id', 'staff-user-1')).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError when the user is not assigned to this lead', async () => {
      const mocks = createMocks();
      mocks.leadRepository.findById.mockResolvedValue(createMockLead());
      mocks.leadAssignmentRepository.findExisting.mockResolvedValue(null);

      const service = createService(mocks);

      await expect(service.unassignLeadUser('lead-1', 'staff-user-1')).rejects.toThrow(NotFoundError);
      expect(mocks.leadAssignmentRepository.forceDelete).not.toHaveBeenCalled();
    });

    it('removes the assignment and records LEAD_ASSIGNMENT_CHANGED', async () => {
      const mocks = createMocks();
      const lead = createMockLead();
      mocks.leadRepository.findById.mockResolvedValue(lead);
      const assignment = createMockLeadAssignment({ leadId: lead.id, userId: 'staff-user-1' });
      mocks.leadAssignmentRepository.findExisting.mockResolvedValue(assignment);

      const service = createService(mocks);
      await service.unassignLeadUser(lead.id, 'staff-user-1');

      expect(mocks.leadAssignmentRepository.forceDelete).toHaveBeenCalledWith(assignment.id, { tenantId: TENANT_ID });
      expect(mocks.auditLogRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: AuditEventType.LEAD_ASSIGNMENT_CHANGED }),
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Proposal (PRD §8.2)
  // ────────────────────────────────────────────────────────────────────────
  describe('sendProposal', () => {
    const dto: SendProposalDto = { proposalValue: 50000, proposalRemarks: 'Initial proposal.' };

    it('throws NotFoundError when the lead does not exist', async () => {
      const mocks = createMocks();
      mocks.leadRepository.findById.mockResolvedValue(null);

      const service = createService(mocks);

      await expect(service.sendProposal('missing-id', dto)).rejects.toThrow(NotFoundError);
      expect(mocks.leadRepository.update).not.toHaveBeenCalled();
    });

    it('sets proposalSentAt and clears any prior accepted/rejected timestamps, and records PROPOSAL_SENT', async () => {
      const mocks = createMocks();
      const existing = createMockLead();
      mocks.leadRepository.findById.mockResolvedValue(existing);
      const updated = createMockLead({ proposalSentAt: new Date('2026-02-01') });
      mocks.leadRepository.update.mockResolvedValue(updated);

      const service = createService(mocks);
      const result = await service.sendProposal(existing.id, dto);

      expect(mocks.leadRepository.update).toHaveBeenCalledWith(
        existing.id,
        expect.objectContaining({
          proposalSentAt: expect.any(Date),
          proposalAcceptedAt: null,
          proposalRejectedAt: null,
          proposalValue: dto.proposalValue,
          proposalRemarks: dto.proposalRemarks,
        }),
        { tenantId: TENANT_ID },
      );
      expect(mocks.auditLogRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: AuditEventType.PROPOSAL_SENT, targetType: 'Lead', targetId: updated.id }),
      );
      expect(result).toBe(updated);
    });

    it('falls back to the existing remarks when not provided', async () => {
      const mocks = createMocks();
      const existing = createMockLead({ proposalRemarks: 'Old remarks' });
      mocks.leadRepository.findById.mockResolvedValue(existing);
      mocks.leadRepository.update.mockResolvedValue(existing);

      const service = createService(mocks);
      await service.sendProposal(existing.id, {});

      expect(mocks.leadRepository.update).toHaveBeenCalledWith(
        existing.id,
        expect.objectContaining({ proposalValue: existing.proposalValue, proposalRemarks: existing.proposalRemarks }),
        { tenantId: TENANT_ID },
      );
    });
  });

  describe('acceptProposal', () => {
    const dto: RespondProposalDto = { proposalRemarks: 'Client accepted.' };

    it('throws NotFoundError when the lead does not exist', async () => {
      const mocks = createMocks();
      mocks.leadRepository.findById.mockResolvedValue(null);

      const service = createService(mocks);

      await expect(service.acceptProposal('missing-id', dto)).rejects.toThrow(NotFoundError);
    });

    it('throws ConflictError when no proposal has been sent yet', async () => {
      const mocks = createMocks();
      mocks.leadRepository.findById.mockResolvedValue(createMockLead({ proposalSentAt: null }));

      const service = createService(mocks);

      await expect(service.acceptProposal('lead-1', dto)).rejects.toThrow(ConflictError);
      expect(mocks.leadRepository.update).not.toHaveBeenCalled();
    });

    it('sets proposalAcceptedAt, clears proposalRejectedAt, and records PROPOSAL_ACCEPTED', async () => {
      const mocks = createMocks();
      const existing = createMockLead({ proposalSentAt: new Date('2026-02-01') });
      mocks.leadRepository.findById.mockResolvedValue(existing);
      const updated = createMockLead({ proposalSentAt: existing.proposalSentAt, proposalAcceptedAt: new Date('2026-02-05') });
      mocks.leadRepository.update.mockResolvedValue(updated);

      const service = createService(mocks);
      const result = await service.acceptProposal(existing.id, dto);

      expect(mocks.leadRepository.update).toHaveBeenCalledWith(
        existing.id,
        { proposalAcceptedAt: expect.any(Date), proposalRejectedAt: null, proposalRemarks: dto.proposalRemarks },
        { tenantId: TENANT_ID },
      );
      expect(mocks.auditLogRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: AuditEventType.PROPOSAL_ACCEPTED }),
      );
      expect(result).toBe(updated);
    });
  });

  describe('rejectProposal', () => {
    const dto: RespondProposalDto = { proposalRemarks: 'Client rejected — too expensive.' };

    it('throws NotFoundError when the lead does not exist', async () => {
      const mocks = createMocks();
      mocks.leadRepository.findById.mockResolvedValue(null);

      const service = createService(mocks);

      await expect(service.rejectProposal('missing-id', dto)).rejects.toThrow(NotFoundError);
    });

    it('throws ConflictError when no proposal has been sent yet', async () => {
      const mocks = createMocks();
      mocks.leadRepository.findById.mockResolvedValue(createMockLead({ proposalSentAt: null }));

      const service = createService(mocks);

      await expect(service.rejectProposal('lead-1', dto)).rejects.toThrow(ConflictError);
      expect(mocks.leadRepository.update).not.toHaveBeenCalled();
    });

    it('sets proposalRejectedAt, clears proposalAcceptedAt, and records PROPOSAL_REJECTED', async () => {
      const mocks = createMocks();
      const existing = createMockLead({ proposalSentAt: new Date('2026-02-01') });
      mocks.leadRepository.findById.mockResolvedValue(existing);
      const updated = createMockLead({ proposalSentAt: existing.proposalSentAt, proposalRejectedAt: new Date('2026-02-05') });
      mocks.leadRepository.update.mockResolvedValue(updated);

      const service = createService(mocks);
      const result = await service.rejectProposal(existing.id, dto);

      expect(mocks.leadRepository.update).toHaveBeenCalledWith(
        existing.id,
        { proposalRejectedAt: expect.any(Date), proposalAcceptedAt: null, proposalRemarks: dto.proposalRemarks },
        { tenantId: TENANT_ID },
      );
      expect(mocks.auditLogRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: AuditEventType.PROPOSAL_REJECTED }),
      );
      expect(result).toBe(updated);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Timeline / Dashboard (PRD §8.10/§8.11)
  // ────────────────────────────────────────────────────────────────────────
  describe('getLeadTimeline', () => {
    it('throws NotFoundError when the lead does not exist', async () => {
      const mocks = createMocks();
      mocks.leadRepository.findById.mockResolvedValue(null);

      const service = createService(mocks);

      await expect(service.getLeadTimeline('missing-id', { page: 1, limit: 20 })).rejects.toThrow(NotFoundError);
      expect(mocks.auditTimelineReader.getTimeline).not.toHaveBeenCalled();
    });

    it('delegates to AuditTimelineReader.getTimeline scoped to this Lead', async () => {
      const mocks = createMocks();
      const lead = createMockLead();
      mocks.leadRepository.findById.mockResolvedValue(lead);
      const timeline = { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } };
      mocks.auditTimelineReader.getTimeline.mockResolvedValue(timeline);

      const service = createService(mocks);
      const result = await service.getLeadTimeline(lead.id, { page: 1, limit: 20 });

      expect(mocks.auditTimelineReader.getTimeline).toHaveBeenCalledWith('Lead', lead.id, TENANT_ID, { page: 1, limit: 20 });
      expect(result).toBe(timeline);
    });
  });

  describe('getDashboardStats', () => {
    it('composes counts from LeadRepository, ClientRepository, and TaskService, computing conversionRate', async () => {
      const mocks = createMocks();
      mocks.leadRepository.getDashboardStats.mockResolvedValue({
        totalLeads: 40,
        activeProposals: 5,
        leadsBySource: [{ sourceId: SOURCE_ID, sourceName: 'Referral', count: 40 }],
      });
      mocks.clientRepository.countByStatus.mockImplementation((statuses: string[]) =>
        Promise.resolve(statuses.includes('FORMER') ? 2 : 10),
      );
      mocks.taskService.countUpcomingLeadFollowUps.mockResolvedValue(7);

      const service = createService(mocks);
      const result = await service.getDashboardStats();

      expect(result).toEqual({
        totalLeads: 40,
        activeProposals: 5,
        convertedClients: 10,
        archivedClients: 2,
        conversionRate: 25,
        leadsBySource: [{ sourceId: SOURCE_ID, sourceName: 'Referral', count: 40 }],
        upcomingFollowUps: 7,
      });
    });

    it('returns a conversionRate of 0 when there are no leads yet (avoids division by zero)', async () => {
      const mocks = createMocks();
      mocks.leadRepository.getDashboardStats.mockResolvedValue({ totalLeads: 0, activeProposals: 0, leadsBySource: [] });
      mocks.clientRepository.countByStatus.mockResolvedValue(0);
      mocks.taskService.countUpcomingLeadFollowUps.mockResolvedValue(0);

      const service = createService(mocks);
      const result = await service.getDashboardStats();

      expect(result.conversionRate).toBe(0);
    });
  });
});
