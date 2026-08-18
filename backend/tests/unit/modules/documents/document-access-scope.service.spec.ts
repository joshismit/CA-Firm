import { DocumentCategory } from '@prisma/client';

/** Same reasoning as document.service.spec.ts — every repository is injected as a mock. */
jest.mock('@config/database', () => ({ prisma: {} }));

import { UserRole } from '@shared/enums';
import { ForbiddenError } from '@shared/errors';
import { RequestUser } from '@shared/types';
import {
  DocumentAccessScope,
  DocumentAccessScopeService,
  ScopedDocument,
} from '@modules/documents/service/document-access-scope.service';
import { RoleRepository } from '@modules/roles/repository/role.repository';
import { BusinessAssignmentRepository } from '@modules/business/repository/business-assignment.repository';
import { ContactRepository } from '@modules/contacts/repository/contact.repository';
import { ContactRoleRepository } from '@modules/contacts/repository/contact-role.repository';
import { DocumentShareRepository } from '@modules/documents/repository/document-share.repository';
import { ACCOUNTANT_ROLE_NAME, AUDITOR_ROLE_NAME } from '@modules/roles/constants/extended-roles.constants';

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';
const BUSINESS_A = 'business-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const BUSINESS_B = 'business-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const CONTACT_ID = 'contact-cccccccc-cccc-cccc-cccc-cccccccccccc';

function baseUser(overrides: Partial<RequestUser> = {}): RequestUser {
  return { id: USER_ID, email: 'user@acme.test', role: UserRole.STAFF, tenantId: TENANT_ID, permissions: [], ...overrides };
}

interface Mocks {
  roleRepository: { findActiveRoleNamesForUser: jest.Mock };
  businessAssignmentRepository: { findBusinessIdsForUser: jest.Mock };
  contactRepository: { findFirst: jest.Mock };
  contactRoleRepository: { findByContact: jest.Mock };
  documentShareRepository: { findSharedDocumentIds: jest.Mock };
}

function createMocks(): Mocks {
  return {
    roleRepository: { findActiveRoleNamesForUser: jest.fn().mockResolvedValue([]) },
    businessAssignmentRepository: { findBusinessIdsForUser: jest.fn().mockResolvedValue([]) },
    contactRepository: { findFirst: jest.fn().mockResolvedValue(null) },
    contactRoleRepository: { findByContact: jest.fn().mockResolvedValue([]) },
    documentShareRepository: { findSharedDocumentIds: jest.fn().mockResolvedValue([]) },
  };
}

function createService(mocks: Mocks): DocumentAccessScopeService {
  return new DocumentAccessScopeService(
    mocks.roleRepository as unknown as RoleRepository,
    mocks.businessAssignmentRepository as unknown as BusinessAssignmentRepository,
    mocks.contactRepository as unknown as ContactRepository,
    mocks.contactRoleRepository as unknown as ContactRoleRepository,
    mocks.documentShareRepository as unknown as DocumentShareRepository,
  );
}

function scopedDoc(overrides: Partial<ScopedDocument> = {}): ScopedDocument {
  return { id: 'doc-1', businessId: BUSINESS_A, contactId: null, category: DocumentCategory.PAN, ...overrides };
}

describe('DocumentAccessScopeService', () => {
  describe('resolve', () => {
    it.each([UserRole.TENANT_ADMIN, UserRole.MASTER_ADMIN, UserRole.MANAGER])(
      'returns an unrestricted scope for %s without touching any repository',
      async (role) => {
        const mocks = createMocks();
        const service = createService(mocks);

        const scope = await service.resolve(baseUser({ role }));

        expect(scope).toEqual({});
        expect(mocks.roleRepository.findActiveRoleNamesForUser).not.toHaveBeenCalled();
        expect(mocks.contactRepository.findFirst).not.toHaveBeenCalled();
      },
    );

    it('returns an unrestricted scope when the user has no tenantId (e.g. a master admin token)', async () => {
      const mocks = createMocks();
      const service = createService(mocks);

      const scope = await service.resolve(baseUser({ role: UserRole.STAFF, tenantId: undefined }));

      expect(scope).toEqual({});
    });

    it('a plain Staff user (no Accountant/Auditor role) gets an unrestricted scope', async () => {
      const mocks = createMocks();
      mocks.roleRepository.findActiveRoleNamesForUser.mockResolvedValue(['Staff']);
      const service = createService(mocks);

      const scope = await service.resolve(baseUser());

      expect(scope).toEqual({});
    });

    it('an Accountant is scoped to their assigned Business IDs', async () => {
      const mocks = createMocks();
      mocks.roleRepository.findActiveRoleNamesForUser.mockResolvedValue([ACCOUNTANT_ROLE_NAME]);
      mocks.businessAssignmentRepository.findBusinessIdsForUser.mockResolvedValue([BUSINESS_A]);
      const service = createService(mocks);

      const scope = await service.resolve(baseUser());

      expect(scope.businessIds).toEqual([BUSINESS_A]);
      expect(mocks.businessAssignmentRepository.findBusinessIdsForUser).toHaveBeenCalledWith(USER_ID, TENANT_ID);
    });

    it('an Accountant with zero assignments is scoped to zero Businesses (deny-all, not unrestricted)', async () => {
      const mocks = createMocks();
      mocks.roleRepository.findActiveRoleNamesForUser.mockResolvedValue(['accountant']); // case-insensitive
      mocks.businessAssignmentRepository.findBusinessIdsForUser.mockResolvedValue([]);
      const service = createService(mocks);

      const scope = await service.resolve(baseUser());

      expect(scope.businessIds).toEqual([]);
    });

    it('an Auditor is scoped to the AUDIT category only', async () => {
      const mocks = createMocks();
      mocks.roleRepository.findActiveRoleNamesForUser.mockResolvedValue([AUDITOR_ROLE_NAME]);
      const service = createService(mocks);

      const scope = await service.resolve(baseUser());

      expect(scope.categories).toEqual([DocumentCategory.AUDIT]);
      expect(scope.businessIds).toBeUndefined();
    });

    it('a user holding both roles gets both restrictions stacked', async () => {
      const mocks = createMocks();
      mocks.roleRepository.findActiveRoleNamesForUser.mockResolvedValue([ACCOUNTANT_ROLE_NAME, AUDITOR_ROLE_NAME]);
      mocks.businessAssignmentRepository.findBusinessIdsForUser.mockResolvedValue([BUSINESS_A]);
      const service = createService(mocks);

      const scope = await service.resolve(baseUser());

      expect(scope.businessIds).toEqual([BUSINESS_A]);
      expect(scope.categories).toEqual([DocumentCategory.AUDIT]);
    });

    it('fetches shared-document grants once the scope is restrictive', async () => {
      const mocks = createMocks();
      mocks.roleRepository.findActiveRoleNamesForUser.mockResolvedValue([AUDITOR_ROLE_NAME]);
      mocks.documentShareRepository.findSharedDocumentIds.mockResolvedValue(['doc-shared']);
      const service = createService(mocks);

      const scope = await service.resolve(baseUser());

      expect(scope.sharedDocumentIds).toEqual(['doc-shared']);
    });

    it('a Client with a linked Contact is scoped to that Contact\'s Business IDs and own contactId', async () => {
      const mocks = createMocks();
      mocks.contactRepository.findFirst.mockResolvedValue({ id: CONTACT_ID });
      mocks.contactRoleRepository.findByContact.mockResolvedValue([
        { businessId: BUSINESS_A },
        { businessId: BUSINESS_A }, // duplicate role on the same business — must be de-duplicated
        { businessId: BUSINESS_B },
      ]);
      const service = createService(mocks);

      const scope = await service.resolve(baseUser({ role: UserRole.CLIENT }));

      expect(scope.businessIds).toEqual([BUSINESS_A, BUSINESS_B]);
      expect(scope.ownContactId).toBe(CONTACT_ID);
      expect(mocks.contactRepository.findFirst).toHaveBeenCalledWith({ portalUserId: USER_ID }, { tenantId: TENANT_ID });
    });

    it('a Client with no linked Contact is scoped to zero Businesses', async () => {
      const mocks = createMocks();
      mocks.contactRepository.findFirst.mockResolvedValue(null);
      const service = createService(mocks);

      const scope = await service.resolve(baseUser({ role: UserRole.CLIENT }));

      // `businessIds: []` is a deliberate deny-all, not "unrestricted" — still restrictive enough
      // to trigger the shared-document lookup (an explicit share must still be able to bypass it).
      expect(scope).toEqual({ businessIds: [], sharedDocumentIds: [] });
      expect(mocks.contactRoleRepository.findByContact).not.toHaveBeenCalled();
    });
  });

  describe('assertAllowed', () => {
    it('allows everything under an unrestricted scope', () => {
      expect(() => DocumentAccessScopeService.assertAllowed(scopedDoc(), {})).not.toThrow();
    });

    it('throws ForbiddenError when the category is outside scope', () => {
      const scope: DocumentAccessScope = { categories: [DocumentCategory.AUDIT] };
      expect(() => DocumentAccessScopeService.assertAllowed(scopedDoc({ category: DocumentCategory.PAN }), scope)).toThrow(
        ForbiddenError,
      );
    });

    it('allows a document whose category is in scope', () => {
      const scope: DocumentAccessScope = { categories: [DocumentCategory.AUDIT] };
      expect(() =>
        DocumentAccessScopeService.assertAllowed(scopedDoc({ category: DocumentCategory.AUDIT }), scope),
      ).not.toThrow();
    });

    it('throws ForbiddenError when the businessId is outside scope and contactId does not match ownContactId', () => {
      const scope: DocumentAccessScope = { businessIds: [BUSINESS_A] };
      expect(() => DocumentAccessScopeService.assertAllowed(scopedDoc({ businessId: BUSINESS_B }), scope)).toThrow(
        ForbiddenError,
      );
    });

    it('allows a document with no Business but a matching own contactId (Client\'s personal documents)', () => {
      const scope: DocumentAccessScope = { businessIds: [BUSINESS_A], ownContactId: CONTACT_ID };
      expect(() =>
        DocumentAccessScopeService.assertAllowed(scopedDoc({ businessId: null, contactId: CONTACT_ID }), scope),
      ).not.toThrow();
    });

    it('an explicit share bypasses both category and Business restrictions', () => {
      const scope: DocumentAccessScope = {
        categories: [DocumentCategory.AUDIT],
        businessIds: [BUSINESS_A],
        sharedDocumentIds: ['doc-1'],
      };
      expect(() =>
        DocumentAccessScopeService.assertAllowed(scopedDoc({ id: 'doc-1', businessId: BUSINESS_B, category: DocumentCategory.PAN }), scope),
      ).not.toThrow();
    });
  });

  describe('toWhereInput', () => {
    it('returns an empty where clause for an unrestricted scope', () => {
      expect(DocumentAccessScopeService.toWhereInput({})).toEqual({});
    });

    it('ANDs category and Business restrictions together', () => {
      const scope: DocumentAccessScope = { categories: [DocumentCategory.AUDIT], businessIds: [BUSINESS_A] };
      expect(DocumentAccessScopeService.toWhereInput(scope)).toEqual({
        AND: [{ category: { in: [DocumentCategory.AUDIT] } }, { businessId: { in: [BUSINESS_A] } }],
      });
    });

    it('ORs in the ownContactId alongside the Business restriction', () => {
      const scope: DocumentAccessScope = { businessIds: [BUSINESS_A], ownContactId: CONTACT_ID };
      expect(DocumentAccessScopeService.toWhereInput(scope)).toEqual({
        AND: [{ OR: [{ businessId: { in: [BUSINESS_A] } }, { contactId: CONTACT_ID }] }],
      });
    });

    it('ORs the whole restriction with sharedDocumentIds when present', () => {
      const scope: DocumentAccessScope = { businessIds: [BUSINESS_A], sharedDocumentIds: ['doc-shared'] };
      expect(DocumentAccessScopeService.toWhereInput(scope)).toEqual({
        OR: [{ AND: [{ businessId: { in: [BUSINESS_A] } }] }, { id: { in: ['doc-shared'] } }],
      });
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Folder variants (PRD §7.1 rule 3) — no contactId/share concept, see
  // `assertFolderAllowed`/`toFolderWhereInput`'s own header comments.
  // ────────────────────────────────────────────────────────────────────────
  describe('assertFolderAllowed', () => {
    const folder = { businessId: BUSINESS_A, category: DocumentCategory.PAN };

    it('allows an unrestricted scope', () => {
      expect(() => DocumentAccessScopeService.assertFolderAllowed(folder, {})).not.toThrow();
    });

    it('throws ForbiddenError when the category is outside scope', () => {
      const scope: DocumentAccessScope = { categories: [DocumentCategory.GST] };
      expect(() => DocumentAccessScopeService.assertFolderAllowed(folder, scope)).toThrow(ForbiddenError);
    });

    it('throws ForbiddenError when the Business is outside scope', () => {
      const scope: DocumentAccessScope = { businessIds: [BUSINESS_B] };
      expect(() => DocumentAccessScopeService.assertFolderAllowed(folder, scope)).toThrow(ForbiddenError);
    });

    it('allows a folder within both restrictions', () => {
      const scope: DocumentAccessScope = { businessIds: [BUSINESS_A], categories: [DocumentCategory.PAN] };
      expect(() => DocumentAccessScopeService.assertFolderAllowed(folder, scope)).not.toThrow();
    });

    it('never bypasses via ownContactId or sharedDocumentIds — folders have neither concept', () => {
      const scope: DocumentAccessScope = { businessIds: [BUSINESS_B], ownContactId: CONTACT_ID, sharedDocumentIds: ['doc-shared'] };
      expect(() => DocumentAccessScopeService.assertFolderAllowed(folder, scope)).toThrow(ForbiddenError);
    });
  });

  describe('toFolderWhereInput', () => {
    it('returns an empty where clause for an unrestricted scope', () => {
      expect(DocumentAccessScopeService.toFolderWhereInput({})).toEqual({});
    });

    it('ANDs category and Business restrictions together', () => {
      const scope: DocumentAccessScope = { categories: [DocumentCategory.AUDIT], businessIds: [BUSINESS_A] };
      expect(DocumentAccessScopeService.toFolderWhereInput(scope)).toEqual({
        AND: [{ category: { in: [DocumentCategory.AUDIT] } }, { businessId: { in: [BUSINESS_A] } }],
      });
    });

    it('ignores ownContactId/sharedDocumentIds entirely (no contactId field on DocumentFolder)', () => {
      const scope: DocumentAccessScope = { businessIds: [BUSINESS_A], ownContactId: CONTACT_ID, sharedDocumentIds: ['doc-shared'] };
      expect(DocumentAccessScopeService.toFolderWhereInput(scope)).toEqual({
        AND: [{ businessId: { in: [BUSINESS_A] } }],
      });
    });
  });
});

