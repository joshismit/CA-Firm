import { Request } from 'express';
import { Task, TaskStatus, TaskType, NotificationChannel } from '@prisma/client';

/**
 * `TaskService`'s constructor defaults to `new TaskRepository(prisma)` (the
 * real `@config/database` singleton) when no repository is injected. These
 * tests always inject an explicit mock repository, so the real `prisma`
 * export is never used — but merely *importing* `TaskService` transitively
 * imports `@config/database`, whose top-level `new PrismaClient(...)` call
 * currently throws at construction time (pre-existing issue: Prisma 7's
 * "client" engine requires a driver adapter that isn't wired up anywhere in
 * this codebase yet — same issue worked around in
 * `project.service.spec.ts`). Stubbing the module here is test-only and does
 * not touch production code.
 */
jest.mock('@config/database', () => ({ prisma: {} }));

import { AuditEventType } from '@prisma/client';
import { UserRole } from '@shared/enums';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@shared/errors';
import { TaskService } from '@modules/tasks/service/task.service';
import { TaskRepository } from '@modules/tasks/repository/task.repository';
import type { AuditLogRecorder } from '@modules/audit';
import type { NotificationDispatchService } from '@modules/notifications/service/notification-dispatch.service';
import type { ContactRepository } from '@modules/contacts/repository/contact.repository';
import type { ContactRoleRepository } from '@modules/contacts/repository/contact-role.repository';
import type { ClientRepository } from '@modules/crm/repository/client.repository';
import type { UserRepository } from '@modules/users/repository/user.repository';
import type { BusinessAssignmentRepository } from '@modules/business/repository/business-assignment.repository';
import {
  CreateTaskDto,
  ListTasksQueryDto,
  UpdateTaskStatusDto,
} from '@modules/tasks/dto/task.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TaskService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `TaskRepository` is fully mocked — these tests exercise only the business
 * logic in `TaskService` (guards, transitions, cross-field validation),
 * never a real database. Mirrors `project.service.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';

type MockedTaskRepository = {
  [K in
    | 'findById'
    | 'create'
    | 'update'
    | 'delete'
    | 'restore'
    | 'findByStatus'
    | 'findByProject'
    | 'findByLead'
    | 'findByAssignee'
    | 'findOverdue'
    | 'findPendingReview'
    | 'search'
    | 'countByStatus'
    | 'countByProject'
    | 'countUpcomingLeadFollowUps']: jest.Mock;
};

function createMockRepository(): MockedTaskRepository {
  return {
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    restore: jest.fn(),
    findByStatus: jest.fn(),
    findByProject: jest.fn(),
    findByLead: jest.fn(),
    findByAssignee: jest.fn(),
    findOverdue: jest.fn(),
    findPendingReview: jest.fn(),
    search: jest.fn(),
    countByStatus: jest.fn(),
    countByProject: jest.fn(),
    countUpcomingLeadFollowUps: jest.fn(),
  };
}

function createFakeRequest(userOverrides: Partial<{ id: string; role: UserRole; permissions: string[] }> = {}): Request {
  return {
    tenant: { id: TENANT_ID, slug: 'acme', name: 'Acme & Co', planCode: 'professional', isActive: true },
    user: {
      id: USER_ID,
      email: 'manager@acme.test',
      role: UserRole.TENANT_ADMIN,
      tenantId: TENANT_ID,
      permissions: [],
      ...userOverrides,
    },
    correlationId: 'test-correlation-id',
  } as unknown as Request;
}

function createMockTask(overrides: Partial<Task> = {}): Task {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'task-33333333-3333-3333-3333-333333333333',
    tenantId: TENANT_ID,
    projectId: null,
    leadId: null,
    assigneeId: null,
    title: 'Prepare draft financials',
    description: null,
    status: TaskStatus.TODO,
    type: null,
    priority: null,
    businessId: null,
    contactId: null,
    clientId: null,
    documentId: null,
    folderId: null,
    startDate: null,
    dueDate: null,
    completedAt: null,
    completedBy: null,
    approvedBy: null,
    rejectedBy: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdBy: USER_ID,
    deletedBy: null,
    ...overrides,
  };
}

function createMockNotificationDispatchService(): { send: jest.Mock } {
  return { send: jest.fn().mockResolvedValue([]) };
}

function createMockAuditLogRecorder(): { record: jest.Mock } {
  return { record: jest.fn().mockResolvedValue(undefined) };
}

/**
 * Defaults model the common (non-CLIENT) caller: `assertAssigneeEligible()` calls
 * `userRepository.findById()` unconditionally for every caller (tenant-membership check), so it
 * must resolve truthy or `createTask`/`updateTask` throw `ValidationError` in tests that never
 * meant to exercise assignee-eligibility at all. `contactRepository.findFirst` resolving `null`
 * means "not a CLIENT caller, not a portal-user assignee" — the right default for every test that
 * isn't specifically about the CLIENT-assignment feature.
 */
function createMockUserRepository(): { findById: jest.Mock } {
  return { findById: jest.fn().mockResolvedValue({ id: 'assignee-default', tenantId: TENANT_ID }) };
}

function createMockContactRepository(): { findFirst: jest.Mock } {
  return { findFirst: jest.fn().mockResolvedValue(null) };
}

function createMockContactRoleRepository(): { findByContact: jest.Mock } {
  return { findByContact: jest.fn().mockResolvedValue([]) };
}

function createMockClientRepository(): { findByBusiness: jest.Mock } {
  return { findByBusiness: jest.fn().mockResolvedValue(null) };
}

function createMockBusinessAssignmentRepository(): { findByBusiness: jest.Mock } {
  return { findByBusiness: jest.fn().mockResolvedValue([]) };
}

function createService(
  repository: MockedTaskRepository,
  notificationDispatchService: { send: jest.Mock } = createMockNotificationDispatchService(),
  auditLogRecorder: { record: jest.Mock } = createMockAuditLogRecorder(),
  req: Request = createFakeRequest(),
  contactRepository: { findFirst: jest.Mock } = createMockContactRepository(),
  contactRoleRepository: { findByContact: jest.Mock } = createMockContactRoleRepository(),
  clientRepository: { findByBusiness: jest.Mock } = createMockClientRepository(),
  userRepository: { findById: jest.Mock } = createMockUserRepository(),
  businessAssignmentRepository: { findByBusiness: jest.Mock } = createMockBusinessAssignmentRepository(),
): TaskService {
  return new TaskService(
    req,
    repository as unknown as TaskRepository,
    auditLogRecorder as unknown as AuditLogRecorder,
    notificationDispatchService as unknown as NotificationDispatchService,
    undefined,
    contactRepository as unknown as ContactRepository,
    contactRoleRepository as unknown as ContactRoleRepository,
    clientRepository as unknown as ClientRepository,
    userRepository as unknown as UserRepository,
    businessAssignmentRepository as unknown as BusinessAssignmentRepository,
  );
}

describe('TaskService', () => {
  // ────────────────────────────────────────────────────────────────────────
  // createTask
  // ────────────────────────────────────────────────────────────────────────
  describe('createTask', () => {
    const dto: CreateTaskDto = {
      title: 'Prepare draft financials',
    };

    it('creates a task in TODO status', async () => {
      const repo = createMockRepository();
      const created = createMockTask();
      repo.create.mockResolvedValue(created);

      const service = createService(repo);
      const result = await service.createTask(dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: dto.title,
          projectId: null,
          assigneeId: null,
          description: null,
          startDate: null,
          dueDate: null,
          status: TaskStatus.TODO,
          createdBy: USER_ID,
        }),
        { tenantId: TENANT_ID },
      );
      expect(result).toBe(created);
    });

    it('passes through projectId/assigneeId/description when provided, and notifies the assignee', async () => {
      const repo = createMockRepository();
      const created = createMockTask({ assigneeId: 'user-assignee-1', title: dto.title });
      repo.create.mockResolvedValue(created);

      const notificationDispatchService = createMockNotificationDispatchService();
      const service = createService(repo, notificationDispatchService);
      await service.createTask({
        ...dto,
        projectId: 'project-1',
        assigneeId: 'user-assignee-1',
        description: 'Compile Q4 figures',
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'project-1',
          assigneeId: 'user-assignee-1',
          description: 'Compile Q4 figures',
        }),
        { tenantId: TENANT_ID },
      );
      expect(notificationDispatchService.send).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        userId: 'user-assignee-1',
        title: 'Task assigned',
        message: expect.stringContaining(dto.title),
        channels: [NotificationChannel.IN_APP],
      });
    });

    it('passes through leadId when provided (PRD §8.7 — links a follow-up task to a CRM Lead)', async () => {
      const repo = createMockRepository();
      repo.create.mockResolvedValue(createMockTask({ leadId: 'lead-1' }));

      const service = createService(repo);
      await service.createTask({ ...dto, leadId: 'lead-1' });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ leadId: 'lead-1' }),
        { tenantId: TENANT_ID },
      );
    });

    it('does NOT notify when the task has no assignee', async () => {
      const repo = createMockRepository();
      repo.create.mockResolvedValue(createMockTask({ assigneeId: null }));

      const notificationDispatchService = createMockNotificationDispatchService();
      const service = createService(repo, notificationDispatchService);
      await service.createTask(dto);

      expect(notificationDispatchService.send).not.toHaveBeenCalled();
    });

    it('does NOT notify when the task is self-assigned', async () => {
      const repo = createMockRepository();
      repo.create.mockResolvedValue(createMockTask({ assigneeId: USER_ID }));

      const notificationDispatchService = createMockNotificationDispatchService();
      const service = createService(repo, notificationDispatchService);
      await service.createTask({ ...dto, assigneeId: USER_ID });

      expect(notificationDispatchService.send).not.toHaveBeenCalled();
    });

    it('throws ValidationError when dueDate is before startDate (validation failure)', async () => {
      const repo = createMockRepository();
      const invalidDto: CreateTaskDto = {
        ...dto,
        startDate: new Date('2026-03-01'),
        dueDate: new Date('2026-02-01'),
      };

      const service = createService(repo);

      await expect(service.createTask(invalidDto)).rejects.toThrow(ValidationError);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // updateTask
  // ────────────────────────────────────────────────────────────────────────
  describe('updateTask', () => {
    it('updates mutable fields', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask());
      const updated = createMockTask({ title: 'Prepare final financials' });
      repo.update.mockResolvedValue(updated);

      const service = createService(repo);
      const result = await service.updateTask('task-1', { title: 'Prepare final financials' });

      expect(repo.update).toHaveBeenCalledWith(
        'task-1',
        { title: 'Prepare final financials' },
        { tenantId: TENANT_ID },
      );
      expect(result).toBe(updated);
    });

    it('throws NotFoundError when the task does not exist', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.updateTask('missing-id', { title: 'New title' })).rejects.toThrow(
        NotFoundError,
      );
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('notifies the new assignee on a genuine reassignment', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask({ assigneeId: 'old-assignee' }));
      const updated = createMockTask({ assigneeId: 'new-assignee' });
      repo.update.mockResolvedValue(updated);

      const notificationDispatchService = createMockNotificationDispatchService();
      const service = createService(repo, notificationDispatchService);
      await service.updateTask('task-1', { assigneeId: 'new-assignee' });

      expect(notificationDispatchService.send).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        userId: 'new-assignee',
        title: 'Task assigned',
        message: expect.any(String),
        channels: [NotificationChannel.IN_APP],
      });
    });

    it('does NOT notify when resubmitting the same assigneeId (idempotent — no duplicate on retry)', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask({ assigneeId: 'same-assignee' }));
      repo.update.mockResolvedValue(createMockTask({ assigneeId: 'same-assignee' }));

      const notificationDispatchService = createMockNotificationDispatchService();
      const service = createService(repo, notificationDispatchService);
      await service.updateTask('task-1', { assigneeId: 'same-assignee' });

      expect(notificationDispatchService.send).not.toHaveBeenCalled();
    });

    it('does NOT notify when assigneeId is not part of the update at all', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask({ assigneeId: 'existing-assignee' }));
      repo.update.mockResolvedValue(createMockTask({ assigneeId: 'existing-assignee', title: 'Renamed' }));

      const notificationDispatchService = createMockNotificationDispatchService();
      const service = createService(repo, notificationDispatchService);
      await service.updateTask('task-1', { title: 'Renamed' });

      expect(notificationDispatchService.send).not.toHaveBeenCalled();
    });

    it('records TASK_ASSIGNED on a genuine reassignment (PRD §9)', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask({ assigneeId: 'old-assignee' }));
      repo.update.mockResolvedValue(createMockTask({ assigneeId: 'new-assignee' }));
      const auditLogRecorder = createMockAuditLogRecorder();

      const service = createService(repo, createMockNotificationDispatchService(), auditLogRecorder);
      await service.updateTask('task-1', { assigneeId: 'new-assignee' });

      expect(auditLogRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: AuditEventType.TASK_ASSIGNED }),
      );
    });

    it('does NOT record TASK_ASSIGNED when assigneeId is not part of the update', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask({ assigneeId: 'existing-assignee' }));
      repo.update.mockResolvedValue(createMockTask({ assigneeId: 'existing-assignee', title: 'Renamed' }));
      const auditLogRecorder = createMockAuditLogRecorder();

      const service = createService(repo, createMockNotificationDispatchService(), auditLogRecorder);
      await service.updateTask('task-1', { title: 'Renamed' });

      expect(auditLogRecorder.record).not.toHaveBeenCalled();
    });

    it('throws ValidationError when only dueDate is patched and it precedes the existing startDate (validation failure)', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(
        createMockTask({ startDate: new Date('2026-03-01'), dueDate: new Date('2026-04-01') }),
      );

      const service = createService(repo);

      await expect(
        service.updateTask('task-1', { dueDate: new Date('2026-02-01') }),
      ).rejects.toThrow(ValidationError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('throws ValidationError when only startDate is patched and it comes after the existing dueDate (validation failure)', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(
        createMockTask({ startDate: new Date('2026-01-01'), dueDate: new Date('2026-02-01') }),
      );

      const service = createService(repo);

      await expect(
        service.updateTask('task-1', { startDate: new Date('2026-03-01') }),
      ).rejects.toThrow(ValidationError);
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // updateTaskStatus — status transitions
  // ────────────────────────────────────────────────────────────────────────
  describe('updateTaskStatus', () => {
    it('allows TODO → IN_PROGRESS, and notifies the assignee (someone else changed their task)', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask({ status: TaskStatus.TODO, assigneeId: 'other-user', title: 'Prepare draft financials' }));
      const updated = createMockTask({ status: TaskStatus.IN_PROGRESS, assigneeId: 'other-user' });
      repo.update.mockResolvedValue(updated);

      const notificationDispatchService = createMockNotificationDispatchService();
      const service = createService(repo, notificationDispatchService);
      const result = await service.updateTaskStatus('task-1', { status: TaskStatus.IN_PROGRESS });

      expect(repo.update).toHaveBeenCalledWith(
        'task-1',
        { status: TaskStatus.IN_PROGRESS },
        { tenantId: TENANT_ID },
      );
      expect(result).toBe(updated);
      expect(notificationDispatchService.send).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        userId: 'other-user',
        title: 'Task status changed',
        message: expect.stringContaining('IN_PROGRESS'),
        channels: [NotificationChannel.IN_APP],
      });
    });

    it('does NOT notify when the caller changes the status of their own assigned task', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask({ status: TaskStatus.TODO, assigneeId: USER_ID }));
      repo.update.mockResolvedValue(createMockTask({ status: TaskStatus.IN_PROGRESS, assigneeId: USER_ID }));

      const notificationDispatchService = createMockNotificationDispatchService();
      const service = createService(repo, notificationDispatchService);
      await service.updateTaskStatus('task-1', { status: TaskStatus.IN_PROGRESS });

      expect(notificationDispatchService.send).not.toHaveBeenCalled();
    });

    it('does NOT notify when the task has no assignee', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask({ status: TaskStatus.TODO, assigneeId: null }));
      repo.update.mockResolvedValue(createMockTask({ status: TaskStatus.IN_PROGRESS, assigneeId: null }));

      const notificationDispatchService = createMockNotificationDispatchService();
      const service = createService(repo, notificationDispatchService);
      await service.updateTaskStatus('task-1', { status: TaskStatus.IN_PROGRESS });

      expect(notificationDispatchService.send).not.toHaveBeenCalled();
    });

    it('throws ConflictError for a transition the state machine does not allow (TODO → COMPLETED)', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask({ status: TaskStatus.TODO }));

      const service = createService(repo);

      await expect(
        service.updateTaskStatus('task-1', { status: TaskStatus.COMPLETED }),
      ).rejects.toThrow(ConflictError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('throws ConflictError when CANCELLED (terminal) is asked to transition anywhere', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask({ status: TaskStatus.CANCELLED }));

      const service = createService(repo);

      await expect(
        service.updateTaskStatus('task-1', { status: TaskStatus.IN_PROGRESS }),
      ).rejects.toThrow(ConflictError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('throws ValidationError when moving to CANCELLED without a reason (validation failure)', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask({ status: TaskStatus.IN_PROGRESS }));

      const service = createService(repo);

      await expect(
        service.updateTaskStatus('task-1', { status: TaskStatus.CANCELLED }),
      ).rejects.toThrow(ValidationError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('allows moving to CANCELLED when a reason is provided', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask({ status: TaskStatus.IN_PROGRESS }));
      repo.update.mockResolvedValue(createMockTask({ status: TaskStatus.CANCELLED }));

      const service = createService(repo);
      const dto: UpdateTaskStatusDto = { status: TaskStatus.CANCELLED, reason: 'No longer needed' };

      await expect(service.updateTaskStatus('task-1', dto)).resolves.toBeDefined();
      expect(repo.update).toHaveBeenCalledWith(
        'task-1',
        { status: TaskStatus.CANCELLED },
        { tenantId: TENANT_ID },
      );
    });

    it('sets completedAt when moving to COMPLETED', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask({ status: TaskStatus.REVIEW }));
      repo.update.mockResolvedValue(createMockTask({ status: TaskStatus.COMPLETED }));

      const service = createService(repo);
      await service.updateTaskStatus('task-1', { status: TaskStatus.COMPLETED });

      expect(repo.update).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({ status: TaskStatus.COMPLETED, completedAt: expect.any(Date) }),
        { tenantId: TENANT_ID },
      );
    });

    // ────────────────────────────────────────────────────────────────────
    // PRD §8.7/§8.11 — completing a Lead-linked follow-up task
    // ────────────────────────────────────────────────────────────────────
    it('records FOLLOWUP_COMPLETED when a Lead-linked task is moved to COMPLETED', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask({ status: TaskStatus.REVIEW, leadId: 'lead-1', title: 'Follow up next week' }));
      repo.update.mockResolvedValue(createMockTask({ status: TaskStatus.COMPLETED, leadId: 'lead-1' }));
      const auditLogRecorder = createMockAuditLogRecorder();

      const service = createService(repo, createMockNotificationDispatchService(), auditLogRecorder);
      await service.updateTaskStatus('task-1', { status: TaskStatus.COMPLETED });

      expect(auditLogRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: AuditEventType.FOLLOWUP_COMPLETED, targetType: 'Lead', targetId: 'lead-1' }),
      );
    });

    it('does NOT record FOLLOWUP_COMPLETED for a plain (non-Lead-linked) task', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask({ status: TaskStatus.REVIEW, leadId: null }));
      repo.update.mockResolvedValue(createMockTask({ status: TaskStatus.COMPLETED, leadId: null }));
      const auditLogRecorder = createMockAuditLogRecorder();

      const service = createService(repo, createMockNotificationDispatchService(), auditLogRecorder);
      await service.updateTaskStatus('task-1', { status: TaskStatus.COMPLETED });

      expect(auditLogRecorder.record).not.toHaveBeenCalledWith(
        expect.objectContaining({ eventType: AuditEventType.FOLLOWUP_COMPLETED }),
      );
    });

    it('does NOT record FOLLOWUP_COMPLETED when a Lead-linked task moves to a non-COMPLETED status', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask({ status: TaskStatus.TODO, leadId: 'lead-1' }));
      repo.update.mockResolvedValue(createMockTask({ status: TaskStatus.IN_PROGRESS, leadId: 'lead-1' }));
      const auditLogRecorder = createMockAuditLogRecorder();

      const service = createService(repo, createMockNotificationDispatchService(), auditLogRecorder);
      await service.updateTaskStatus('task-1', { status: TaskStatus.IN_PROGRESS });

      expect(auditLogRecorder.record).not.toHaveBeenCalledWith(
        expect.objectContaining({ eventType: AuditEventType.FOLLOWUP_COMPLETED }),
      );
    });

    it('clears completedAt when reopening (COMPLETED → IN_PROGRESS)', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(
        createMockTask({ status: TaskStatus.COMPLETED, completedAt: new Date('2026-01-05') }),
      );
      repo.update.mockResolvedValue(createMockTask({ status: TaskStatus.IN_PROGRESS, completedAt: null }));

      const service = createService(repo);
      await service.updateTaskStatus('task-1', { status: TaskStatus.IN_PROGRESS });

      expect(repo.update).toHaveBeenCalledWith(
        'task-1',
        { status: TaskStatus.IN_PROGRESS, completedAt: null, completedBy: null },
        { tenantId: TENANT_ID },
      );
    });

    it('throws NotFoundError when the task does not exist', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);

      await expect(
        service.updateTaskStatus('missing-id', { status: TaskStatus.IN_PROGRESS }),
      ).rejects.toThrow(NotFoundError);
    });

    // ────────────────────────────────────────────────────────────────────
    // PRD §9 — approval workflow transitions
    // ────────────────────────────────────────────────────────────────────
    describe('approval workflow (PRD §9)', () => {
      it.each([
        [TaskStatus.REQUESTED, TaskStatus.SUBMITTED],
        [TaskStatus.SUBMITTED, TaskStatus.UNDER_REVIEW],
        [TaskStatus.SUBMITTED, TaskStatus.APPROVED],
        [TaskStatus.SUBMITTED, TaskStatus.REJECTED],
        [TaskStatus.UNDER_REVIEW, TaskStatus.APPROVED],
        [TaskStatus.UNDER_REVIEW, TaskStatus.REJECTED],
        [TaskStatus.APPROVED, TaskStatus.COMPLETED],
        [TaskStatus.REJECTED, TaskStatus.REQUESTED],
      ])('allows %s → %s', async (from, to) => {
        const repo = createMockRepository();
        repo.findById.mockResolvedValue(createMockTask({ status: from, type: TaskType.APPROVAL }));
        repo.update.mockResolvedValue(createMockTask({ status: to, type: TaskType.APPROVAL }));

        const service = createService(repo);
        const reason = to === TaskStatus.REJECTED ? 'Missing signature' : undefined;

        await expect(
          service.updateTaskStatus('task-1', { status: to, reason }),
        ).resolves.toBeDefined();
      });

      // The PRD's explicit invalid-transition examples.
      it.each([
        [TaskStatus.COMPLETED, TaskStatus.REQUESTED],
        [TaskStatus.REJECTED, TaskStatus.APPROVED],
        [TaskStatus.APPROVED, TaskStatus.SUBMITTED],
      ])('blocks %s → %s (PRD invalid-transition example)', async (from, to) => {
        const repo = createMockRepository();
        repo.findById.mockResolvedValue(createMockTask({ status: from, type: TaskType.APPROVAL }));

        const service = createService(repo);

        await expect(service.updateTaskStatus('task-1', { status: to })).rejects.toThrow(
          ConflictError,
        );
        expect(repo.update).not.toHaveBeenCalled();
      });

      it('throws ValidationError when moving to REJECTED without a reason', async () => {
        const repo = createMockRepository();
        repo.findById.mockResolvedValue(createMockTask({ status: TaskStatus.SUBMITTED, type: TaskType.APPROVAL }));

        const service = createService(repo);

        await expect(
          service.updateTaskStatus('task-1', { status: TaskStatus.REJECTED }),
        ).rejects.toThrow(ValidationError);
        expect(repo.update).not.toHaveBeenCalled();
      });

      it('stamps approvedBy when moving to APPROVED', async () => {
        const repo = createMockRepository();
        repo.findById.mockResolvedValue(createMockTask({ status: TaskStatus.SUBMITTED, type: TaskType.APPROVAL }));
        repo.update.mockResolvedValue(createMockTask({ status: TaskStatus.APPROVED, type: TaskType.APPROVAL }));

        const service = createService(repo);
        await service.updateTaskStatus('task-1', { status: TaskStatus.APPROVED });

        expect(repo.update).toHaveBeenCalledWith(
          'task-1',
          { status: TaskStatus.APPROVED, approvedBy: USER_ID },
          { tenantId: TENANT_ID },
        );
      });

      it('stamps rejectedBy when moving to REJECTED', async () => {
        const repo = createMockRepository();
        repo.findById.mockResolvedValue(createMockTask({ status: TaskStatus.SUBMITTED, type: TaskType.APPROVAL }));
        repo.update.mockResolvedValue(createMockTask({ status: TaskStatus.REJECTED, type: TaskType.APPROVAL }));

        const service = createService(repo);
        await service.updateTaskStatus('task-1', { status: TaskStatus.REJECTED, reason: 'Incomplete data' });

        expect(repo.update).toHaveBeenCalledWith(
          'task-1',
          { status: TaskStatus.REJECTED, rejectedBy: USER_ID },
          { tenantId: TENANT_ID },
        );
      });

      it('stamps completedBy in addition to completedAt when moving to COMPLETED', async () => {
        const repo = createMockRepository();
        repo.findById.mockResolvedValue(createMockTask({ status: TaskStatus.APPROVED, type: TaskType.APPROVAL }));
        repo.update.mockResolvedValue(createMockTask({ status: TaskStatus.COMPLETED, type: TaskType.APPROVAL }));

        const service = createService(repo);
        await service.updateTaskStatus('task-1', { status: TaskStatus.COMPLETED });

        expect(repo.update).toHaveBeenCalledWith(
          'task-1',
          expect.objectContaining({ status: TaskStatus.COMPLETED, completedAt: expect.any(Date), completedBy: USER_ID }),
          { tenantId: TENANT_ID },
        );
      });

      it.each([
        [AuditEventType.TASK_SUBMITTED, TaskStatus.REQUESTED, TaskStatus.SUBMITTED],
        [AuditEventType.TASK_APPROVED, TaskStatus.SUBMITTED, TaskStatus.APPROVED],
        [AuditEventType.TASK_REJECTED, TaskStatus.SUBMITTED, TaskStatus.REJECTED],
        [AuditEventType.TASK_COMPLETED, TaskStatus.APPROVED, TaskStatus.COMPLETED],
        [AuditEventType.TASK_REOPENED, TaskStatus.REJECTED, TaskStatus.REQUESTED],
        [AuditEventType.TASK_REOPENED, TaskStatus.COMPLETED, TaskStatus.IN_PROGRESS],
      ])('records %s for the %s → %s transition', async (eventType, from, to) => {
        const repo = createMockRepository();
        repo.findById.mockResolvedValue(createMockTask({ status: from, type: TaskType.APPROVAL }));
        repo.update.mockResolvedValue(createMockTask({ status: to, type: TaskType.APPROVAL }));
        const auditLogRecorder = createMockAuditLogRecorder();

        const service = createService(repo, createMockNotificationDispatchService(), auditLogRecorder);
        const reason = to === TaskStatus.REJECTED ? 'Needs rework' : undefined;
        await service.updateTaskStatus('task-1', { status: to, reason });

        expect(auditLogRecorder.record).toHaveBeenCalledWith(
          expect.objectContaining({ eventType }),
        );
      });
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Lifecycle action wrappers (PRD §9)
  // ────────────────────────────────────────────────────────────────────────
  describe('lifecycle action wrappers', () => {
    it('assignTask delegates to updateTask with the new assigneeId', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask({ assigneeId: 'old-assignee' }));
      repo.update.mockResolvedValue(createMockTask({ assigneeId: 'new-assignee' }));

      const service = createService(repo);
      await service.assignTask('task-1', 'new-assignee');

      expect(repo.update).toHaveBeenCalledWith(
        'task-1',
        { assigneeId: 'new-assignee' },
        { tenantId: TENANT_ID },
      );
    });

    it('submitTask moves REQUESTED → SUBMITTED', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask({ status: TaskStatus.REQUESTED, type: TaskType.APPROVAL }));
      repo.update.mockResolvedValue(createMockTask({ status: TaskStatus.SUBMITTED, type: TaskType.APPROVAL }));

      const service = createService(repo);
      await service.submitTask('task-1');

      expect(repo.update).toHaveBeenCalledWith(
        'task-1',
        { status: TaskStatus.SUBMITTED },
        { tenantId: TENANT_ID },
      );
    });

    it('completeTask moves APPROVED → COMPLETED', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask({ status: TaskStatus.APPROVED, type: TaskType.APPROVAL }));
      repo.update.mockResolvedValue(createMockTask({ status: TaskStatus.COMPLETED, type: TaskType.APPROVAL }));

      const service = createService(repo);
      await service.completeTask('task-1');

      expect(repo.update).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({ status: TaskStatus.COMPLETED }),
        { tenantId: TENANT_ID },
      );
    });

    describe('reopenTask', () => {
      it('reopens a COMPLETED task to IN_PROGRESS', async () => {
        const repo = createMockRepository();
        repo.findById.mockResolvedValue(createMockTask({ status: TaskStatus.COMPLETED }));
        repo.update.mockResolvedValue(createMockTask({ status: TaskStatus.IN_PROGRESS }));

        const service = createService(repo);
        await service.reopenTask('task-1');

        expect(repo.update).toHaveBeenCalledWith(
          'task-1',
          { status: TaskStatus.IN_PROGRESS, completedAt: null, completedBy: null },
          { tenantId: TENANT_ID },
        );
      });

      it('reopens a REJECTED task to REQUESTED', async () => {
        const repo = createMockRepository();
        repo.findById.mockResolvedValue(createMockTask({ status: TaskStatus.REJECTED, type: TaskType.APPROVAL }));
        repo.update.mockResolvedValue(createMockTask({ status: TaskStatus.REQUESTED, type: TaskType.APPROVAL }));

        const service = createService(repo);
        await service.reopenTask('task-1');

        expect(repo.update).toHaveBeenCalledWith(
          'task-1',
          { status: TaskStatus.REQUESTED },
          { tenantId: TENANT_ID },
        );
      });

      it('throws ConflictError when the task is not in a reopenable status', async () => {
        const repo = createMockRepository();
        repo.findById.mockResolvedValue(createMockTask({ status: TaskStatus.TODO }));

        const service = createService(repo);

        await expect(service.reopenTask('task-1')).rejects.toThrow(ConflictError);
        expect(repo.update).not.toHaveBeenCalled();
      });
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // createTask — approval workflow initial status (PRD §9)
  // ────────────────────────────────────────────────────────────────────────
  describe('createTask — approval workflow', () => {
    it('starts REQUESTED when a type is provided', async () => {
      const repo = createMockRepository();
      repo.create.mockResolvedValue(createMockTask({ type: TaskType.APPROVAL, status: TaskStatus.REQUESTED }));

      const service = createService(repo);
      await service.createTask({ title: 'Approve payroll run', type: TaskType.APPROVAL });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: TaskType.APPROVAL, status: TaskStatus.REQUESTED }),
        { tenantId: TENANT_ID },
      );
    });

    it('starts TODO when no type is provided (backward-compatible simple flow)', async () => {
      const repo = createMockRepository();
      repo.create.mockResolvedValue(createMockTask({ status: TaskStatus.TODO }));

      const service = createService(repo);
      await service.createTask({ title: 'Plain task, no type' });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: null, status: TaskStatus.TODO }),
        { tenantId: TENANT_ID },
      );
    });

    it('records TASK_CREATED on every creation', async () => {
      const repo = createMockRepository();
      repo.create.mockResolvedValue(createMockTask());
      const auditLogRecorder = createMockAuditLogRecorder();

      const service = createService(repo, createMockNotificationDispatchService(), auditLogRecorder);
      await service.createTask({ title: 'Plain task' });

      expect(auditLogRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: AuditEventType.TASK_CREATED }),
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // deleteTask — REQUESTED is also deletable now (PRD §9)
  // ────────────────────────────────────────────────────────────────────────
  describe('deleteTask — REQUESTED status (PRD §9)', () => {
    it('soft-deletes a task in REQUESTED status', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask({ status: TaskStatus.REQUESTED, type: TaskType.APPROVAL }));
      repo.delete.mockResolvedValue(true);

      const service = createService(repo);
      await service.deleteTask('task-1');

      expect(repo.delete).toHaveBeenCalledWith('task-1', { tenantId: TENANT_ID, userId: USER_ID });
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // deleteTask — delete restrictions
  // ────────────────────────────────────────────────────────────────────────
  describe('deleteTask', () => {
    it('throws NotFoundError when the task does not exist', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.deleteTask('missing-id')).rejects.toThrow(NotFoundError);
    });

    it.each([TaskStatus.IN_PROGRESS, TaskStatus.REVIEW, TaskStatus.COMPLETED])(
      'throws ConflictError when the task status is %s (not deletable)',
      async (status) => {
        const repo = createMockRepository();
        repo.findById.mockResolvedValue(createMockTask({ status }));

        const service = createService(repo);

        await expect(service.deleteTask('task-1')).rejects.toThrow(ConflictError);
        expect(repo.delete).not.toHaveBeenCalled();
      },
    );

    it.each([TaskStatus.TODO, TaskStatus.CANCELLED])(
      'soft-deletes a task in %s status',
      async (status) => {
        const repo = createMockRepository();
        repo.findById.mockResolvedValue(createMockTask({ status }));
        repo.delete.mockResolvedValue(true);

        const service = createService(repo);
        await service.deleteTask('task-1');

        expect(repo.delete).toHaveBeenCalledWith('task-1', { tenantId: TENANT_ID, userId: USER_ID });
      },
    );
  });

  // ────────────────────────────────────────────────────────────────────────
  // restoreTask
  // ────────────────────────────────────────────────────────────────────────
  describe('restoreTask', () => {
    it('throws NotFoundError when the task does not exist at all (including among deleted records)', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.restoreTask('missing-id')).rejects.toThrow(NotFoundError);
      expect(repo.findById).toHaveBeenCalledWith('missing-id', {
        tenantId: TENANT_ID,
        ignoreSoftDelete: true,
      });
    });

    it('throws ConflictError when the task is not deleted', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockTask({ deletedAt: null }));

      const service = createService(repo);

      await expect(service.restoreTask('task-1')).rejects.toThrow(ConflictError);
      expect(repo.restore).not.toHaveBeenCalled();
    });

    it('restores a soft-deleted task', async () => {
      const repo = createMockRepository();
      const deletedTask = createMockTask({ deletedAt: new Date(), deletedBy: USER_ID });
      const restoredTask = createMockTask({ deletedAt: null, deletedBy: null });

      repo.findById
        .mockResolvedValueOnce(deletedTask) // initial lookup (ignoreSoftDelete: true)
        .mockResolvedValueOnce(restoredTask); // re-fetch after restore
      repo.restore.mockResolvedValue(true);

      const service = createService(repo);
      const result = await service.restoreTask('task-1');

      expect(repo.restore).toHaveBeenCalledWith('task-1', { tenantId: TENANT_ID });
      expect(result).toBe(restoredTask);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // getTaskById
  // ────────────────────────────────────────────────────────────────────────
  describe('getTaskById', () => {
    it('returns the task when found', async () => {
      const repo = createMockRepository();
      const task = createMockTask();
      repo.findById.mockResolvedValue(task);

      const service = createService(repo);
      const result = await service.getTaskById(task.id);

      expect(repo.findById).toHaveBeenCalledWith(task.id, { tenantId: TENANT_ID });
      expect(result).toBe(task);
    });

    it('throws NotFoundError when no task matches the ID', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.getTaskById('missing-id')).rejects.toThrow(NotFoundError);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // listTasks
  // ────────────────────────────────────────────────────────────────────────
  describe('listTasks', () => {
    it('delegates to repository.search with the filters and pagination mapped from the query', async () => {
      const repo = createMockRepository();
      const tasks = [createMockTask(), createMockTask({ id: 'task-2' })];
      const paginated = {
        data: tasks,
        meta: { page: 1, limit: 20, total: 2, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      };
      repo.search.mockResolvedValue(paginated);

      const service = createService(repo);
      const query: ListTasksQueryDto = {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        search: 'financials',
        status: TaskStatus.IN_PROGRESS,
        projectId: 'project-1',
      };

      const result = await service.listTasks(query);

      expect(repo.search).toHaveBeenCalledWith(
        {
          status: TaskStatus.IN_PROGRESS,
          projectId: 'project-1',
          assigneeId: undefined,
          type: undefined,
          priority: undefined,
          dueBefore: undefined,
          dueAfter: undefined,
          search: 'financials',
        },
        { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
        { tenantId: TENANT_ID },
        {},
      );
      expect(result).toBe(paginated);
    });

    it('narrows to the caller\'s own assignee/creator tasks when they lack unrestricted task access', async () => {
      const repo = createMockRepository();
      repo.search.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } });
      const restrictedReq = createFakeRequest({ role: UserRole.STAFF, permissions: [] });
      const service = createService(repo, undefined, undefined, restrictedReq);

      await service.listTasks({ page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' });

      expect(repo.search).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { tenantId: TENANT_ID },
        { OR: [{ assigneeId: USER_ID }, { createdBy: USER_ID }] },
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // getTaskById — access scope
  // ────────────────────────────────────────────────────────────────────────
  describe('getTaskById', () => {
    it('returns the task when the caller is its assignee', async () => {
      const repo = createMockRepository();
      const task = createMockTask({ assigneeId: USER_ID, createdBy: 'someone-else' });
      repo.findById.mockResolvedValue(task);
      const restrictedReq = createFakeRequest({ role: UserRole.STAFF, permissions: [] });
      const service = createService(repo, undefined, undefined, restrictedReq);

      const result = await service.getTaskById(task.id);

      expect(result).toBe(task);
    });

    it('rejects a restricted caller who is neither the assignee nor creator', async () => {
      const repo = createMockRepository();
      const task = createMockTask({ assigneeId: 'someone-else', createdBy: 'someone-else' });
      repo.findById.mockResolvedValue(task);
      const restrictedReq = createFakeRequest({ role: UserRole.STAFF, permissions: [] });
      const service = createService(repo, undefined, undefined, restrictedReq);

      await expect(service.getTaskById(task.id)).rejects.toThrow(ForbiddenError);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // getTasksByProject / getTasksByAssignee
  // ────────────────────────────────────────────────────────────────────────
  describe('getTasksByProject', () => {
    it('delegates to repository.findByProject scoped to the tenant', async () => {
      const repo = createMockRepository();
      const tasks = [createMockTask({ projectId: 'project-1' })];
      repo.findByProject.mockResolvedValue(tasks);

      const service = createService(repo);
      const result = await service.getTasksByProject('project-1');

      expect(repo.findByProject).toHaveBeenCalledWith('project-1', { tenantId: TENANT_ID });
      expect(result).toBe(tasks);
    });
  });

  describe('getTasksByLead', () => {
    it('delegates to repository.findByLead scoped to the tenant (PRD §8.7 follow-up tasks)', async () => {
      const repo = createMockRepository();
      const tasks = [createMockTask({ leadId: 'lead-1' })];
      repo.findByLead.mockResolvedValue(tasks);

      const service = createService(repo);
      const result = await service.getTasksByLead('lead-1');

      expect(repo.findByLead).toHaveBeenCalledWith('lead-1', { tenantId: TENANT_ID });
      expect(result).toBe(tasks);
    });
  });

  describe('getTasksByAssignee', () => {
    it('delegates to repository.findByAssignee scoped to the tenant', async () => {
      const repo = createMockRepository();
      const tasks = [createMockTask({ assigneeId: 'user-assignee-1' })];
      repo.findByAssignee.mockResolvedValue(tasks);

      const service = createService(repo);
      const result = await service.getTasksByAssignee('user-assignee-1');

      expect(repo.findByAssignee).toHaveBeenCalledWith('user-assignee-1', { tenantId: TENANT_ID });
      expect(result).toBe(tasks);
    });

    it('rejects a restricted (non-unrestricted-permission) caller requesting another user\'s tasks — PRD §14.6 enumeration fix', async () => {
      const repo = createMockRepository();
      const restrictedReq = createFakeRequest({ role: UserRole.STAFF, permissions: [] });
      const service = createService(repo, undefined, undefined, restrictedReq);

      await expect(service.getTasksByAssignee('some-other-user')).rejects.toThrow(ForbiddenError);
      expect(repo.findByAssignee).not.toHaveBeenCalled();
    });

    it('allows a restricted caller to request their own tasks', async () => {
      const repo = createMockRepository();
      const tasks = [createMockTask({ assigneeId: USER_ID })];
      repo.findByAssignee.mockResolvedValue(tasks);
      const restrictedReq = createFakeRequest({ role: UserRole.STAFF, permissions: [] });
      const service = createService(repo, undefined, undefined, restrictedReq);

      const result = await service.getTasksByAssignee(USER_ID);

      expect(repo.findByAssignee).toHaveBeenCalledWith(USER_ID, { tenantId: TENANT_ID });
      expect(result).toBe(tasks);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // getOverdueTasks — overdue logic
  // ────────────────────────────────────────────────────────────────────────
  describe('getOverdueTasks', () => {
    it('delegates to repository.findOverdue scoped to the tenant', async () => {
      const repo = createMockRepository();
      const overdueTasks = [
        createMockTask({ dueDate: new Date('2020-01-01'), status: TaskStatus.IN_PROGRESS }),
      ];
      repo.findOverdue.mockResolvedValue(overdueTasks);

      const service = createService(repo);
      const result = await service.getOverdueTasks();

      expect(repo.findOverdue).toHaveBeenCalledWith({ tenantId: TENANT_ID }, {});
      expect(result).toBe(overdueTasks);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // getPendingReviewTasks (PRD §9)
  // ────────────────────────────────────────────────────────────────────────
  describe('getPendingReviewTasks', () => {
    it('delegates to repository.findPendingReview scoped to the tenant', async () => {
      const repo = createMockRepository();
      const pending = [
        createMockTask({ status: TaskStatus.SUBMITTED, type: TaskType.APPROVAL }),
      ];
      repo.findPendingReview.mockResolvedValue(pending);

      const service = createService(repo);
      const result = await service.getPendingReviewTasks();

      expect(repo.findPendingReview).toHaveBeenCalledWith({ tenantId: TENANT_ID }, {});
      expect(result).toBe(pending);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // countByStatus / countByProject
  // ────────────────────────────────────────────────────────────────────────
  describe('countByStatus', () => {
    it('delegates to repository.countByStatus scoped to the tenant', async () => {
      const repo = createMockRepository();
      repo.countByStatus.mockResolvedValue(5);

      const service = createService(repo);
      const result = await service.countByStatus(TaskStatus.TODO);

      expect(repo.countByStatus).toHaveBeenCalledWith(TaskStatus.TODO, { tenantId: TENANT_ID });
      expect(result).toBe(5);
    });
  });

  describe('countByProject', () => {
    it('delegates to repository.countByProject scoped to the tenant', async () => {
      const repo = createMockRepository();
      repo.countByProject.mockResolvedValue(3);

      const service = createService(repo);
      const result = await service.countByProject('project-1');

      expect(repo.countByProject).toHaveBeenCalledWith('project-1', { tenantId: TENANT_ID });
      expect(result).toBe(3);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // countUpcomingLeadFollowUps (PRD §8.10 — CRM dashboard "Upcoming Follow-ups")
  // ────────────────────────────────────────────────────────────────────────
  describe('countUpcomingLeadFollowUps', () => {
    it('delegates to repository.countUpcomingLeadFollowUps with a [now, +30 days] range, scoped to the tenant', async () => {
      const repo = createMockRepository();
      repo.countUpcomingLeadFollowUps.mockResolvedValue(7);

      const service = createService(repo);
      const result = await service.countUpcomingLeadFollowUps();

      expect(repo.countUpcomingLeadFollowUps).toHaveBeenCalledWith(
        { gte: expect.any(Date), lte: expect.any(Date) },
        { tenantId: TENANT_ID },
      );
      const [{ gte, lte }] = repo.countUpcomingLeadFollowUps.mock.calls[0];
      expect(lte.getTime() - gte.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
      expect(result).toBe(7);
    });
  });
});
