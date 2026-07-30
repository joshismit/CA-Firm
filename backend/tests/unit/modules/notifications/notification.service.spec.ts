import { Request } from 'express';
import { Notification, NotificationChannel, NotificationStatus } from '@prisma/client';

/** See the identical comment in tests/unit/modules/contacts/contact.service.spec.ts for why @config/database is stubbed. */
jest.mock('@config/database', () => ({ prisma: {} }));

import { UserRole } from '@shared/enums';
import { NotFoundError } from '@shared/errors';
import { NotificationService } from '@modules/notifications/service/notification.service';
import { NotificationRepository } from '@modules/notifications/repository/notification.repository';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * NotificationService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * The repository is fully mocked — exercises only NotificationService's
 * business logic (ownership scoping via `this.userId`, not-found guards on
 * missing/not-owned rows, DTO → repository mapping). Mirrors
 * `tests/unit/modules/contacts/contact.service.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';
const OTHER_USER_ID = 'user-33333333-3333-3333-3333-333333333333';
const NOTIFICATION_ID = 'notification-44444444-4444-4444-4444-444444444444';

type MockedRepository = {
  [K in 'search' | 'findByIdForUser' | 'markAsRead' | 'markAllAsRead' | 'deleteForUser']: jest.Mock;
};

function createMockRepository(): MockedRepository {
  return {
    search: jest.fn(),
    findByIdForUser: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    deleteForUser: jest.fn(),
  };
}

function createFakeRequest(userId: string = USER_ID): Request {
  return {
    tenant: { id: TENANT_ID, slug: 'acme', name: 'Acme & Co', planCode: 'professional', isActive: true },
    user: { id: userId, email: 'staff@acme.test', role: UserRole.TENANT_ADMIN, tenantId: TENANT_ID, permissions: [] },
    correlationId: 'test-correlation-id',
  } as unknown as Request;
}

function createMockNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: NOTIFICATION_ID,
    tenantId: TENANT_ID,
    userId: USER_ID,
    channel: NotificationChannel.IN_APP,
    status: NotificationStatus.DELIVERED,
    title: 'Task assigned',
    message: 'You have been assigned a new task.',
    isRead: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

function createService(repository: MockedRepository, req: Request = createFakeRequest()): NotificationService {
  return new NotificationService(req, repository as unknown as NotificationRepository);
}

describe('NotificationService', () => {
  describe('listNotifications', () => {
    it('delegates to repository.search scoped to the caller (this.userId)', async () => {
      const repo = createMockRepository();
      const paginated = {
        data: [createMockNotification()],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      };
      repo.search.mockResolvedValue(paginated);

      const service = createService(repo);
      const result = await service.listNotifications({
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        search: 'task',
        channel: NotificationChannel.IN_APP,
        status: NotificationStatus.DELIVERED,
        unreadOnly: true,
      });

      expect(repo.search).toHaveBeenCalledWith(
        { userId: USER_ID, search: 'task', channel: NotificationChannel.IN_APP, status: NotificationStatus.DELIVERED, unreadOnly: true },
        { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
        { tenantId: TENANT_ID },
      );
      expect(result).toBe(paginated);
    });
  });

  describe('getNotificationById', () => {
    it('returns the notification when found for this caller', async () => {
      const repo = createMockRepository();
      const notification = createMockNotification();
      repo.findByIdForUser.mockResolvedValue(notification);

      const service = createService(repo);
      const result = await service.getNotificationById(NOTIFICATION_ID);

      expect(repo.findByIdForUser).toHaveBeenCalledWith(NOTIFICATION_ID, USER_ID, { tenantId: TENANT_ID });
      expect(result).toBe(notification);
    });

    it('throws NotFoundError when no notification matches (missing, or belongs to another user)', async () => {
      const repo = createMockRepository();
      repo.findByIdForUser.mockResolvedValue(null);

      const service = createService(repo);

      await expect(service.getNotificationById('missing-id')).rejects.toThrow(NotFoundError);
    });

    it("a different caller's userId never sees another user's notification (repository call uses their own userId)", async () => {
      const repo = createMockRepository();
      repo.findByIdForUser.mockResolvedValue(null);

      const service = createService(repo, createFakeRequest(OTHER_USER_ID));
      await expect(service.getNotificationById(NOTIFICATION_ID)).rejects.toThrow(NotFoundError);

      expect(repo.findByIdForUser).toHaveBeenCalledWith(NOTIFICATION_ID, OTHER_USER_ID, { tenantId: TENANT_ID });
    });
  });

  describe('markAsRead', () => {
    it('throws NotFoundError when the repository reports no matching row updated', async () => {
      const repo = createMockRepository();
      repo.markAsRead.mockResolvedValue(false);

      const service = createService(repo);

      await expect(service.markAsRead('missing-id')).rejects.toThrow(NotFoundError);
    });

    it('marks the notification as read, scoped to this caller', async () => {
      const repo = createMockRepository();
      repo.markAsRead.mockResolvedValue(true);

      const service = createService(repo);
      await service.markAsRead(NOTIFICATION_ID);

      expect(repo.markAsRead).toHaveBeenCalledWith(NOTIFICATION_ID, USER_ID, { tenantId: TENANT_ID });
    });
  });

  describe('markAllAsRead', () => {
    it('delegates to repository.markAllAsRead scoped to this caller', async () => {
      const repo = createMockRepository();
      repo.markAllAsRead.mockResolvedValue(3);

      const service = createService(repo);
      await service.markAllAsRead();

      expect(repo.markAllAsRead).toHaveBeenCalledWith(USER_ID, { tenantId: TENANT_ID });
    });
  });

  describe('deleteNotification', () => {
    it('throws NotFoundError when the repository reports no matching row deleted', async () => {
      const repo = createMockRepository();
      repo.deleteForUser.mockResolvedValue(false);

      const service = createService(repo);

      await expect(service.deleteNotification('missing-id')).rejects.toThrow(NotFoundError);
    });

    it('soft-deletes the notification, scoped to this caller', async () => {
      const repo = createMockRepository();
      repo.deleteForUser.mockResolvedValue(true);

      const service = createService(repo);
      await service.deleteNotification(NOTIFICATION_ID);

      expect(repo.deleteForUser).toHaveBeenCalledWith(NOTIFICATION_ID, USER_ID, { tenantId: TENANT_ID });
    });
  });
});
