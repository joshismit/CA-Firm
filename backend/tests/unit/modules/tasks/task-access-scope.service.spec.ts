/** Same reasoning as document-access-scope.service.spec.ts — every repository is injected as a mock. */
jest.mock('@config/database', () => ({ prisma: {} }));

import { UserRole } from '@shared/enums';
import { ForbiddenError } from '@shared/errors';
import { RequestUser } from '@shared/types';
import { ScopedTask, TaskAccessScopeService } from '@modules/tasks/service/task-access-scope.service';
import { TASK_PERMISSIONS } from '@modules/tasks/constants/task.permissions';
import { ContactRepository } from '@modules/contacts/repository/contact.repository';
import { ContactRoleRepository } from '@modules/contacts/repository/contact-role.repository';

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';
const OTHER_USER_ID = 'user-33333333-3333-3333-3333-333333333333';
const CONTACT_ID = 'contact-44444444-4444-4444-4444-444444444444';
const BUSINESS_A = 'business-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const BUSINESS_B = 'business-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

function baseUser(overrides: Partial<RequestUser> = {}): RequestUser {
  return { id: USER_ID, email: 'user@acme.test', role: UserRole.STAFF, tenantId: TENANT_ID, permissions: [], ...overrides };
}

function scopedTask(overrides: Partial<ScopedTask> = {}): ScopedTask {
  return { id: 'task-1', assigneeId: null, createdBy: null, businessId: null, ...overrides };
}

interface Mocks {
  contactRepository: { findFirst: jest.Mock };
  contactRoleRepository: { findByContact: jest.Mock };
}

function createMocks(): Mocks {
  return {
    contactRepository: { findFirst: jest.fn().mockResolvedValue(null) },
    contactRoleRepository: { findByContact: jest.fn().mockResolvedValue([]) },
  };
}

function createService(mocks: Mocks): TaskAccessScopeService {
  return new TaskAccessScopeService(
    mocks.contactRepository as unknown as ContactRepository,
    mocks.contactRoleRepository as unknown as ContactRoleRepository,
  );
}

describe('TaskAccessScopeService', () => {
  describe('resolve', () => {
    it('is unrestricted for TENANT_ADMIN', async () => {
      const service = createService(createMocks());
      expect(await service.resolve(baseUser({ role: UserRole.TENANT_ADMIN }))).toEqual({});
    });

    it('is unrestricted for MASTER_ADMIN', async () => {
      const service = createService(createMocks());
      expect(await service.resolve(baseUser({ role: UserRole.MASTER_ADMIN }))).toEqual({});
    });

    it('is unrestricted for a holder of tasks:manage', async () => {
      const service = createService(createMocks());
      expect(await service.resolve(baseUser({ permissions: [TASK_PERMISSIONS.MANAGE] }))).toEqual({});
    });

    it('is unrestricted for a holder of tasks:review — reviewers need the tenant-wide review queue, not just their own tasks', async () => {
      const service = createService(createMocks());
      expect(await service.resolve(baseUser({ permissions: [TASK_PERMISSIONS.REVIEW] }))).toEqual({});
    });

    it('is unrestricted for a holder of tasks:approve — same reasoning as tasks:review', async () => {
      const service = createService(createMocks());
      expect(await service.resolve(baseUser({ permissions: [TASK_PERMISSIONS.APPROVE] }))).toEqual({});
    });

    it('is unrestricted (tenant-wide) for a STAFF user holding only tasks:read — every existing read route already requires it, so this is the common case', async () => {
      const service = createService(createMocks());
      expect(await service.resolve(baseUser({ permissions: [TASK_PERMISSIONS.READ] }))).toEqual({});
    });

    it('restricts a STAFF user with no task permissions to their own userId (defensive fallback)', async () => {
      const service = createService(createMocks());
      expect(await service.resolve(baseUser({ permissions: [] }))).toEqual({ userId: USER_ID });
    });

    it('resolves a CLIENT user to their linked Contact\'s Business ids, deduplicated', async () => {
      const mocks = createMocks();
      mocks.contactRepository.findFirst.mockResolvedValue({ id: CONTACT_ID });
      mocks.contactRoleRepository.findByContact.mockResolvedValue([
        { businessId: BUSINESS_A },
        { businessId: BUSINESS_B },
        { businessId: BUSINESS_A },
      ]);
      const service = createService(mocks);

      const scope = await service.resolve(baseUser({ role: UserRole.CLIENT, permissions: [TASK_PERMISSIONS.CREATE, TASK_PERMISSIONS.READ, TASK_PERMISSIONS.ASSIGN] }));

      expect(scope).toEqual({ businessIds: [BUSINESS_A, BUSINESS_B] });
      expect(mocks.contactRepository.findFirst).toHaveBeenCalledWith({ portalUserId: USER_ID }, { tenantId: TENANT_ID });
      expect(mocks.contactRoleRepository.findByContact).toHaveBeenCalledWith(CONTACT_ID, { tenantId: TENANT_ID });
    });

    it('resolves a CLIENT user with no linked Contact to zero access, not an error', async () => {
      const mocks = createMocks();
      mocks.contactRepository.findFirst.mockResolvedValue(null);
      const service = createService(mocks);

      const scope = await service.resolve(baseUser({ role: UserRole.CLIENT }));

      expect(scope).toEqual({ businessIds: [] });
      expect(mocks.contactRoleRepository.findByContact).not.toHaveBeenCalled();
    });

    it('never grants a CLIENT the fully-unrestricted scope even though they hold tasks:read — regression test for the cross-client leak this branch exists to prevent', async () => {
      const mocks = createMocks();
      mocks.contactRepository.findFirst.mockResolvedValue({ id: CONTACT_ID });
      mocks.contactRoleRepository.findByContact.mockResolvedValue([{ businessId: BUSINESS_A }]);
      const service = createService(mocks);

      const scope = await service.resolve(baseUser({ role: UserRole.CLIENT, permissions: [TASK_PERMISSIONS.READ] }));

      expect(scope).not.toEqual({});
      expect(scope).toEqual({ businessIds: [BUSINESS_A] });
    });

    it('returns zero access for a CLIENT user with no tenantId, without touching any repository', async () => {
      const mocks = createMocks();
      const service = createService(mocks);

      const scope = await service.resolve(baseUser({ role: UserRole.CLIENT, tenantId: undefined }));

      expect(scope).toEqual({ businessIds: [] });
      expect(mocks.contactRepository.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('assertAllowed', () => {
    it('never throws when the scope is unrestricted', () => {
      expect(() => TaskAccessScopeService.assertAllowed(scopedTask({ assigneeId: OTHER_USER_ID }), {})).not.toThrow();
    });

    it('allows a restricted user who is the assignee', () => {
      expect(() =>
        TaskAccessScopeService.assertAllowed(scopedTask({ assigneeId: USER_ID }), { userId: USER_ID }),
      ).not.toThrow();
    });

    it('allows a restricted user who is the creator', () => {
      expect(() =>
        TaskAccessScopeService.assertAllowed(scopedTask({ createdBy: USER_ID }), { userId: USER_ID }),
      ).not.toThrow();
    });

    it('rejects a restricted user who is neither assignee nor creator', () => {
      expect(() =>
        TaskAccessScopeService.assertAllowed(
          scopedTask({ assigneeId: OTHER_USER_ID, createdBy: OTHER_USER_ID }),
          { userId: USER_ID },
        ),
      ).toThrow(ForbiddenError);
    });

    it('allows a businessIds-scoped (CLIENT) user when the task belongs to one of their Businesses', () => {
      expect(() =>
        TaskAccessScopeService.assertAllowed(scopedTask({ businessId: BUSINESS_A }), { businessIds: [BUSINESS_A, BUSINESS_B] }),
      ).not.toThrow();
    });

    it('rejects a businessIds-scoped (CLIENT) user when the task belongs to a different Business', () => {
      expect(() =>
        TaskAccessScopeService.assertAllowed(scopedTask({ businessId: BUSINESS_B }), { businessIds: [BUSINESS_A] }),
      ).toThrow(ForbiddenError);
    });

    it('rejects a businessIds-scoped (CLIENT) user when the task has no Business at all', () => {
      expect(() =>
        TaskAccessScopeService.assertAllowed(scopedTask({ businessId: null }), { businessIds: [BUSINESS_A] }),
      ).toThrow(ForbiddenError);
    });

    it('businessIds scope takes precedence over userId when (hypothetically) both are set', () => {
      expect(() =>
        TaskAccessScopeService.assertAllowed(
          scopedTask({ businessId: null, assigneeId: USER_ID }),
          { businessIds: [BUSINESS_A], userId: USER_ID },
        ),
      ).toThrow(ForbiddenError);
    });
  });

  describe('toWhereInput', () => {
    it('returns an empty filter when unrestricted', () => {
      expect(TaskAccessScopeService.toWhereInput({})).toEqual({});
    });

    it('returns an assignee-or-creator OR filter when restricted by userId', () => {
      expect(TaskAccessScopeService.toWhereInput({ userId: USER_ID })).toEqual({
        OR: [{ assigneeId: USER_ID }, { createdBy: USER_ID }],
      });
    });

    it('returns a businessId-in filter when restricted by businessIds', () => {
      expect(TaskAccessScopeService.toWhereInput({ businessIds: [BUSINESS_A, BUSINESS_B] })).toEqual({
        businessId: { in: [BUSINESS_A, BUSINESS_B] },
      });
    });

    it('returns a businessId-in filter for an empty businessIds array (zero access, not a no-op)', () => {
      expect(TaskAccessScopeService.toWhereInput({ businessIds: [] })).toEqual({ businessId: { in: [] } });
    });
  });
});
