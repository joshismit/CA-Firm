import { UserRole } from '@shared/enums';
import { ForbiddenError } from '@shared/errors';
import { RequestUser } from '@shared/types';
import { ScopedTask, TaskAccessScopeService } from '@modules/tasks/service/task-access-scope.service';
import { TASK_PERMISSIONS } from '@modules/tasks/constants/task.permissions';

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';
const OTHER_USER_ID = 'user-33333333-3333-3333-3333-333333333333';

function baseUser(overrides: Partial<RequestUser> = {}): RequestUser {
  return { id: USER_ID, email: 'user@acme.test', role: UserRole.STAFF, tenantId: TENANT_ID, permissions: [], ...overrides };
}

function scopedTask(overrides: Partial<ScopedTask> = {}): ScopedTask {
  return { id: 'task-1', assigneeId: null, createdBy: null, ...overrides };
}

describe('TaskAccessScopeService', () => {
  const service = new TaskAccessScopeService();

  describe('resolve', () => {
    it('is unrestricted for TENANT_ADMIN', () => {
      expect(service.resolve(baseUser({ role: UserRole.TENANT_ADMIN }))).toEqual({});
    });

    it('is unrestricted for MASTER_ADMIN', () => {
      expect(service.resolve(baseUser({ role: UserRole.MASTER_ADMIN }))).toEqual({});
    });

    it('is unrestricted for a holder of tasks:manage', () => {
      expect(service.resolve(baseUser({ permissions: [TASK_PERMISSIONS.MANAGE] }))).toEqual({});
    });

    it('is unrestricted for a holder of tasks:review — reviewers need the tenant-wide review queue, not just their own tasks', () => {
      expect(service.resolve(baseUser({ permissions: [TASK_PERMISSIONS.REVIEW] }))).toEqual({});
    });

    it('is unrestricted for a holder of tasks:approve — same reasoning as tasks:review', () => {
      expect(service.resolve(baseUser({ permissions: [TASK_PERMISSIONS.APPROVE] }))).toEqual({});
    });

    it('restricts a plain STAFF user with only tasks:read to their own userId', () => {
      expect(service.resolve(baseUser({ permissions: [TASK_PERMISSIONS.READ] }))).toEqual({ userId: USER_ID });
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
  });

  describe('toWhereInput', () => {
    it('returns an empty filter when unrestricted', () => {
      expect(TaskAccessScopeService.toWhereInput({})).toEqual({});
    });

    it('returns an assignee-or-creator OR filter when restricted', () => {
      expect(TaskAccessScopeService.toWhereInput({ userId: USER_ID })).toEqual({
        OR: [{ assigneeId: USER_ID }, { createdBy: USER_ID }],
      });
    });
  });
});
