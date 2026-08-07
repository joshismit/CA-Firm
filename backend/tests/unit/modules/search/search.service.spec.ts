import { Request } from 'express';

jest.mock('@config/database', () => ({ prisma: {} }));

import { UserRole } from '@shared/enums';
import { SearchService } from '@modules/search/service/search.service';
import { BusinessRepository } from '@modules/business/repository/business.repository';
import { ContactRepository } from '@modules/contacts/repository/contact.repository';
import { LeadRepository } from '@modules/crm/repository/lead.repository';
import { DocumentRepository } from '@modules/documents/repository/document.repository';
import { TaskRepository } from '@modules/tasks/repository/task.repository';
import { DocumentAccessScopeService } from '@modules/documents/service/document-access-scope.service';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SearchService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Every repository/access-scope dependency is mocked — exercises only
 * `SearchService`'s own logic: per-category permission gating (PRD §13.1
 * "Staff should only search data they are allowed to see"), the Documents
 * access-scope pass-through, parallel fan-out, and the grouped response
 * shape. Mirrors `tests/unit/modules/reports/report.service.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';

const BUSINESS_READ = 'business:read';
const CONTACTS_READ = 'contacts:read';
const CRM_READ = 'crm:read';
const DOCUMENTS_READ = 'documents:read';
const TASKS_READ = 'tasks:read';

function createFakeRequest(permissions: string[]): Request {
  return {
    tenant: { id: TENANT_ID, slug: 'acme', name: 'Acme & Co', planCode: 'professional', isActive: true },
    user: { id: USER_ID, email: 'staff@acme.test', role: UserRole.STAFF, tenantId: TENANT_ID, permissions },
    correlationId: 'test-correlation-id',
  } as unknown as Request;
}

interface Mocks {
  businessRepository: BusinessRepository;
  contactRepository: ContactRepository;
  leadRepository: LeadRepository;
  documentRepository: DocumentRepository;
  taskRepository: TaskRepository;
  documentAccessScopeService: DocumentAccessScopeService;
}

function createMocks(): Mocks {
  return {
    businessRepository: { findForGlobalSearch: jest.fn().mockResolvedValue([]) } as unknown as BusinessRepository,
    contactRepository: { findForGlobalSearch: jest.fn().mockResolvedValue([]) } as unknown as ContactRepository,
    leadRepository: { findForGlobalSearch: jest.fn().mockResolvedValue([]) } as unknown as LeadRepository,
    documentRepository: { findForGlobalSearch: jest.fn().mockResolvedValue([]) } as unknown as DocumentRepository,
    taskRepository: { findForGlobalSearch: jest.fn().mockResolvedValue([]) } as unknown as TaskRepository,
    documentAccessScopeService: { resolve: jest.fn().mockResolvedValue({}) } as unknown as DocumentAccessScopeService,
  };
}

function createService(mocks: Mocks, permissions: string[]): SearchService {
  return new SearchService(
    createFakeRequest(permissions),
    mocks.businessRepository,
    mocks.contactRepository,
    mocks.leadRepository,
    mocks.documentRepository,
    mocks.taskRepository,
    mocks.documentAccessScopeService,
  );
}

describe('SearchService', () => {
  it('returns every category as an empty array, and calls no repository, when the caller has none of the five :read permissions', async () => {
    const mocks = createMocks();
    const service = createService(mocks, []);

    const result = await service.search('acme', 10);

    expect(result).toEqual({ businesses: [], contacts: [], leads: [], documents: [], tasks: [] });
    expect(mocks.businessRepository.findForGlobalSearch).not.toHaveBeenCalled();
    expect(mocks.contactRepository.findForGlobalSearch).not.toHaveBeenCalled();
    expect(mocks.leadRepository.findForGlobalSearch).not.toHaveBeenCalled();
    expect(mocks.documentRepository.findForGlobalSearch).not.toHaveBeenCalled();
    expect(mocks.taskRepository.findForGlobalSearch).not.toHaveBeenCalled();
  });

  it('includes only the categories the caller holds :read for', async () => {
    const mocks = createMocks();
    (mocks.taskRepository.findForGlobalSearch as jest.Mock).mockResolvedValue([{ id: 'task-1', title: 'Prepare GST filing', status: 'TODO' }]);
    const service = createService(mocks, [TASKS_READ]);

    const result = await service.search('gst', 10);

    expect(result.tasks).toEqual([{ id: 'task-1', type: 'TASK', title: 'Prepare GST filing', subtitle: 'TODO', route: '/tasks/task-1', highlightedField: 'title' }]);
    expect(result.businesses).toEqual([]);
    expect(mocks.businessRepository.findForGlobalSearch).not.toHaveBeenCalled();
    expect(mocks.contactRepository.findForGlobalSearch).not.toHaveBeenCalled();
    expect(mocks.leadRepository.findForGlobalSearch).not.toHaveBeenCalled();
    expect(mocks.documentRepository.findForGlobalSearch).not.toHaveBeenCalled();
  });

  it('maps a Business row into the PRD §13.1 result shape, picking the field that actually matched as highlightedField', async () => {
    const mocks = createMocks();
    (mocks.businessRepository.findForGlobalSearch as jest.Mock).mockResolvedValue([
      { id: 'biz-1', name: 'Acme Corp', tradeName: null, pan: 'ABCDE1234F', gstin: null, din: null, phone: null, email: null },
    ]);
    const service = createService(mocks, [BUSINESS_READ]);

    const result = await service.search('ABCDE1234F', 10);

    expect(result.businesses).toEqual([
      { id: 'biz-1', type: 'BUSINESS', title: 'Acme Corp', subtitle: 'ABCDE1234F', route: '/business/biz-1', highlightedField: 'pan' },
    ]);
  });

  it('Documents: resolves the access scope and passes its where-fragment through to findForGlobalSearch', async () => {
    const mocks = createMocks();
    const scope = { businessIds: ['biz-1'] };
    (mocks.documentAccessScopeService.resolve as jest.Mock).mockResolvedValue(scope);
    (mocks.documentRepository.findForGlobalSearch as jest.Mock).mockResolvedValue([]);
    const service = createService(mocks, [DOCUMENTS_READ]);

    await service.search('invoice.pdf', 10);

    expect(mocks.documentAccessScopeService.resolve).toHaveBeenCalledWith(expect.objectContaining({ id: USER_ID }));
    const expectedWhere = DocumentAccessScopeService.toWhereInput(scope);
    expect(mocks.documentRepository.findForGlobalSearch).toHaveBeenCalledWith('invoice.pdf', 10, { tenantId: TENANT_ID }, expectedWhere);
  });

  it('with every permission granted, fans out to all five finders in parallel', async () => {
    const mocks = createMocks();
    const service = createService(mocks, [BUSINESS_READ, CONTACTS_READ, CRM_READ, DOCUMENTS_READ, TASKS_READ]);

    await service.search('acme', 5);

    expect(mocks.businessRepository.findForGlobalSearch).toHaveBeenCalledWith('acme', 5, { tenantId: TENANT_ID });
    expect(mocks.contactRepository.findForGlobalSearch).toHaveBeenCalledWith('acme', 5, { tenantId: TENANT_ID });
    expect(mocks.leadRepository.findForGlobalSearch).toHaveBeenCalledWith('acme', 5, { tenantId: TENANT_ID });
    expect(mocks.taskRepository.findForGlobalSearch).toHaveBeenCalledWith('acme', 5, { tenantId: TENANT_ID });
  });
});
