import { Request } from 'express';
import { Contact, ContactRole, ContactRoleType } from '@prisma/client';

/**
 * See the identical comment in tests/unit/modules/business/business.service.spec.ts
 * for why @config/database is stubbed. This module additionally provides a
 * working `$transaction` stub — ContactService.assignContactRole() is the
 * first service in this codebase to actually call `this.transaction()` for
 * real (Project/Task only ever left `// TODO: wrap in this.transaction()`
 * comments), so the mock must support it: it invokes the callback
 * immediately with a fake tx object and returns whatever the callback
 * resolves to, mirroring Prisma's real $transaction(fn) behavior closely
 * enough for these unit tests (which never actually touch Postgres).
 */
jest.mock('@config/database', () => ({
  prisma: { $transaction: jest.fn((operation: (tx: unknown) => unknown) => operation({})) },
}));
import { UserRole } from '@shared/enums';
import { ConflictError, NotFoundError } from '@shared/errors';
import { ContactService } from '@modules/contacts/service/contact.service';
import { ContactRepository } from '@modules/contacts/repository/contact.repository';
import { ContactRoleRepository } from '@modules/contacts/repository/contact-role.repository';
import {
  AssignContactRoleDto,
  CreateContactDto,
  ListContactsQueryDto,
  UpdateContactDto,
} from '@modules/contacts/dto/contact.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ContactService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Both repositories are fully mocked — these tests exercise only the
 * business logic in `ContactService` (existence guards, duplicate-role
 * guard, primary-contact exclusivity, DTO → repository mapping), never a
 * real database. Mirrors `tests/unit/modules/business/business.service.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';
const BUSINESS_ID = 'business-66666666-6666-6666-6666-666666666666';

type MockedContactRepository = {
  [K in 'findById' | 'create' | 'update' | 'delete' | 'search']: jest.Mock;
};

type MockedContactRoleRepository = {
  [K in 'findByContact' | 'findExisting' | 'clearPrimaryForBusiness' | 'create']: jest.Mock;
};

function createMockRepository(): MockedContactRepository {
  return { findById: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), search: jest.fn() };
}

function createMockRoleRepository(): MockedContactRoleRepository {
  return {
    findByContact: jest.fn(),
    findExisting: jest.fn(),
    clearPrimaryForBusiness: jest.fn(),
    create: jest.fn(),
  };
}

function createFakeRequest(): Request {
  return {
    tenant: { id: TENANT_ID, slug: 'acme', name: 'Acme & Co', planCode: 'professional', isActive: true },
    user: { id: USER_ID, email: 'manager@acme.test', role: UserRole.TENANT_ADMIN, tenantId: TENANT_ID, permissions: [] },
    correlationId: 'test-correlation-id',
  } as unknown as Request;
}

function createMockContact(overrides: Partial<Contact> = {}): Contact {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'contact-33333333-3333-3333-3333-333333333333',
    tenantId: TENANT_ID,
    firstName: 'Rohan',
    lastName: 'Mehta',
    email: null,
    phone: null,
    pan: null,
    aadhaarHash: null,
    portalUserId: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function createMockContactRole(overrides: Partial<ContactRole> = {}): ContactRole {
  return {
    id: 'role-77777777-7777-7777-7777-777777777777',
    tenantId: TENANT_ID,
    businessId: BUSINESS_ID,
    contactId: 'contact-33333333-3333-3333-3333-333333333333',
    roleType: ContactRoleType.DIRECTOR,
    customTitle: null,
    isPrimary: false,
    sharePercent: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createService(
  repository: MockedContactRepository,
  roleRepository: MockedContactRoleRepository = createMockRoleRepository(),
): ContactService {
  return new ContactService(
    createFakeRequest(),
    repository as unknown as ContactRepository,
    roleRepository as unknown as ContactRoleRepository,
  );
}

describe('ContactService', () => {
  // ────────────────────────────────────────────────────────────────────────
  // createContact
  // ────────────────────────────────────────────────────────────────────────
  describe('createContact', () => {
    it('creates a contact, nulling every omitted optional field', async () => {
      const repo = createMockRepository();
      const created = createMockContact();
      repo.create.mockResolvedValue(created);

      const service = createService(repo);
      const dto: CreateContactDto = { firstName: 'Rohan' };
      const result = await service.createContact(dto);

      expect(repo.create).toHaveBeenCalledWith(
        { firstName: 'Rohan', lastName: null, email: null, phone: null, pan: null },
        { tenantId: TENANT_ID },
      );
      expect(result).toBe(created);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // updateContact
  // ────────────────────────────────────────────────────────────────────────
  describe('updateContact', () => {
    it('throws NotFoundError when the contact does not exist', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);
      const dto: UpdateContactDto = { firstName: 'Renamed' };

      await expect(service.updateContact('missing-id', dto)).rejects.toThrow(NotFoundError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('updates the contact when it exists', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockContact());
      const updated = createMockContact({ firstName: 'Rohan (renamed)' });
      repo.update.mockResolvedValue(updated);

      const service = createService(repo);
      const dto: UpdateContactDto = { firstName: 'Rohan (renamed)' };
      const result = await service.updateContact('contact-1', dto);

      expect(repo.update).toHaveBeenCalledWith('contact-1', dto, { tenantId: TENANT_ID });
      expect(result).toBe(updated);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // deleteContact
  // ────────────────────────────────────────────────────────────────────────
  describe('deleteContact', () => {
    it('throws NotFoundError when the contact does not exist', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.deleteContact('missing-id')).rejects.toThrow(NotFoundError);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('soft-deletes an existing contact without passing userId (Contact has no deletedBy column)', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockContact());
      repo.delete.mockResolvedValue(true);

      const service = createService(repo);
      await service.deleteContact('contact-1');

      expect(repo.delete).toHaveBeenCalledWith('contact-1', { tenantId: TENANT_ID });
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // getContactById / listContacts
  // ────────────────────────────────────────────────────────────────────────
  describe('getContactById', () => {
    it('returns the contact when found', async () => {
      const repo = createMockRepository();
      const contact = createMockContact();
      repo.findById.mockResolvedValue(contact);

      const service = createService(repo);
      const result = await service.getContactById(contact.id);

      expect(repo.findById).toHaveBeenCalledWith(contact.id, { tenantId: TENANT_ID });
      expect(result).toBe(contact);
    });

    it('throws NotFoundError when no contact matches the ID', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.getContactById('missing-id')).rejects.toThrow(NotFoundError);
    });
  });

  describe('listContacts', () => {
    it('delegates to repository.search with the filters and pagination mapped from the query', async () => {
      const repo = createMockRepository();
      const contacts = [createMockContact(), createMockContact({ id: 'contact-2' })];
      const paginated = {
        data: contacts,
        meta: { page: 1, limit: 20, total: 2, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      };
      repo.search.mockResolvedValue(paginated);

      const service = createService(repo);
      const query: ListContactsQueryDto = {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        search: 'rohan',
        businessId: BUSINESS_ID,
      };

      const result = await service.listContacts(query);

      expect(repo.search).toHaveBeenCalledWith(
        { businessId: BUSINESS_ID, search: 'rohan' },
        { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
        { tenantId: TENANT_ID },
      );
      expect(result).toBe(paginated);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // listContactRoles
  // ────────────────────────────────────────────────────────────────────────
  describe('listContactRoles', () => {
    it('throws NotFoundError when the contact does not exist', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.listContactRoles('missing-id')).rejects.toThrow(NotFoundError);
    });

    it('delegates to contactRoleRepository.findByContact', async () => {
      const repo = createMockRepository();
      const roleRepo = createMockRoleRepository();
      repo.findById.mockResolvedValue(createMockContact());
      const roles = [createMockContactRole()];
      roleRepo.findByContact.mockResolvedValue(roles);

      const service = createService(repo, roleRepo);
      const result = await service.listContactRoles('contact-1');

      expect(roleRepo.findByContact).toHaveBeenCalledWith('contact-1', { tenantId: TENANT_ID });
      expect(result).toBe(roles);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // assignContactRole
  // ────────────────────────────────────────────────────────────────────────
  describe('assignContactRole', () => {
    const dto: AssignContactRoleDto = {
      businessId: BUSINESS_ID,
      contactId: 'contact-33333333-3333-3333-3333-333333333333',
      roleType: ContactRoleType.DIRECTOR,
    };

    it('throws NotFoundError when the contact does not exist', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.assignContactRole(dto)).rejects.toThrow(NotFoundError);
    });

    it('throws ConflictError when this exact (business, contact, roleType) role already exists', async () => {
      const repo = createMockRepository();
      const roleRepo = createMockRoleRepository();
      repo.findById.mockResolvedValue(createMockContact());
      roleRepo.findExisting.mockResolvedValue(createMockContactRole());

      const service = createService(repo, roleRepo);

      await expect(service.assignContactRole(dto)).rejects.toThrow(ConflictError);
      expect(roleRepo.create).not.toHaveBeenCalled();
    });

    it('creates the role without touching other primaries when isPrimary is not set', async () => {
      const repo = createMockRepository();
      const roleRepo = createMockRoleRepository();
      repo.findById.mockResolvedValue(createMockContact());
      roleRepo.findExisting.mockResolvedValue(null);
      const created = createMockContactRole();
      roleRepo.create.mockResolvedValue(created);

      const service = createService(repo, roleRepo);
      const result = await service.assignContactRole(dto);

      expect(roleRepo.clearPrimaryForBusiness).not.toHaveBeenCalled();
      expect(roleRepo.create).toHaveBeenCalledWith(
        {
          businessId: dto.businessId,
          contactId: dto.contactId,
          roleType: dto.roleType,
          customTitle: null,
          isPrimary: false,
          sharePercent: null,
        },
        { tenantId: TENANT_ID, tx: {} },
      );
      expect(result).toBe(created);
    });

    it('clears the previous primary for the business before creating a new primary role', async () => {
      const repo = createMockRepository();
      const roleRepo = createMockRoleRepository();
      repo.findById.mockResolvedValue(createMockContact());
      roleRepo.findExisting.mockResolvedValue(null);
      const created = createMockContactRole({ isPrimary: true });
      roleRepo.create.mockResolvedValue(created);

      const service = createService(repo, roleRepo);
      const primaryDto: AssignContactRoleDto = { ...dto, isPrimary: true };
      const result = await service.assignContactRole(primaryDto);

      expect(roleRepo.clearPrimaryForBusiness).toHaveBeenCalledWith(dto.businessId, {
        tenantId: TENANT_ID,
        tx: {},
      });
      expect(roleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isPrimary: true }),
        { tenantId: TENANT_ID, tx: {} },
      );
      expect(result).toBe(created);
    });
  });
});
