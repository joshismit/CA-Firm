import { Request } from 'express';
import { Business, Client, ClientStatus, Contact, ContactRole, ContactRoleType, Lead, LeadConversion, LeadStage } from '@prisma/client';

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
import { ClientRepository } from '@modules/crm/repository/client.repository';
import { ContactRoleRepository } from '@modules/contacts';
import { BusinessService } from '@modules/business';
import {
  ConvertLeadDto,
  CreateLeadDto,
  ListLeadsQueryDto,
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
  [K in 'findById' | 'create' | 'update' | 'delete' | 'search']: jest.Mock;
};
type MockedLeadStageRepository = { [K in 'listAll']: jest.Mock };
type MockedLeadConversionRepository = { [K in 'findByLead' | 'create']: jest.Mock };
type MockedClientRepository = { [K in 'findByBusiness' | 'create']: jest.Mock };
type MockedContactRoleRepository = {
  [K in 'findExisting' | 'clearPrimaryForBusiness' | 'create']: jest.Mock;
};
type MockedBusinessService = { [K in 'getBusinessById']: jest.Mock };

function createMockLeadRepository(): MockedLeadRepository {
  return { findById: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), search: jest.fn() };
}
function createMockLeadStageRepository(): MockedLeadStageRepository {
  return { listAll: jest.fn() };
}
function createMockLeadConversionRepository(): MockedLeadConversionRepository {
  return { findByLead: jest.fn(), create: jest.fn() };
}
function createMockClientRepository(): MockedClientRepository {
  return { findByBusiness: jest.fn(), create: jest.fn() };
}
function createMockContactRoleRepository(): MockedContactRoleRepository {
  return { findExisting: jest.fn(), clearPrimaryForBusiness: jest.fn(), create: jest.fn() };
}
function createMockBusinessService(): MockedBusinessService {
  return { getBusinessById: jest.fn() };
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
    expectedRevenue: null,
    probability: null,
    expectedCloseDate: null,
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
}

function createMocks(): ServiceMocks {
  return {
    leadRepository: createMockLeadRepository(),
    leadStageRepository: createMockLeadStageRepository(),
    leadConversionRepository: createMockLeadConversionRepository(),
    clientRepository: createMockClientRepository(),
    contactRoleRepository: createMockContactRoleRepository(),
    businessService: createMockBusinessService(),
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
  );
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
          expectedRevenue: null,
          probability: null,
          expectedCloseDate: null,
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
});
