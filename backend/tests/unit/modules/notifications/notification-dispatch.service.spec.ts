import { Notification, NotificationChannel, NotificationStatus } from '@prisma/client';

/** See the identical comment in tests/unit/modules/contacts/contact.service.spec.ts for why @config/database is stubbed. */
jest.mock('@config/database', () => ({ prisma: {} }));
jest.mock('@config/queue', () => ({ notificationQueue: { add: jest.fn() } }));

import { notificationQueue } from '@config/queue';
import { NotificationDispatchService } from '@modules/notifications/service/notification-dispatch.service';
import { NotificationRepository } from '@modules/notifications/repository/notification.repository';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * NotificationDispatchService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * The repository and `notificationQueue` are fully mocked — exercises only
 * this service's own branching: `IN_APP` is created `SENT` and never
 * enqueued; every other channel is created `PENDING` and enqueued with the
 * new row's ID.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';

const addMock = notificationQueue.add as jest.Mock;

function createMockRepository(): { create: jest.Mock } {
  return { create: jest.fn() };
}

function createMockNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'notification-id',
    tenantId: TENANT_ID,
    userId: USER_ID,
    channel: NotificationChannel.IN_APP,
    status: NotificationStatus.SENT,
    title: 'Title',
    message: 'Message',
    isRead: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

describe('NotificationDispatchService', () => {
  beforeEach(() => {
    addMock.mockReset();
  });

  it('creates an IN_APP row as SENT and never touches the queue', async () => {
    const repo = createMockRepository();
    const notification = createMockNotification();
    repo.create.mockResolvedValue(notification);

    const service = new NotificationDispatchService(repo as unknown as NotificationRepository);
    const result = await service.send({
      tenantId: TENANT_ID,
      userId: USER_ID,
      title: 'Task assigned',
      message: 'You have a new task.',
      channels: [NotificationChannel.IN_APP],
    });

    expect(repo.create).toHaveBeenCalledWith(
      { userId: USER_ID, channel: NotificationChannel.IN_APP, title: 'Task assigned', message: 'You have a new task.', status: NotificationStatus.SENT },
      { tenantId: TENANT_ID },
    );
    expect(addMock).not.toHaveBeenCalled();
    expect(result).toEqual([notification]);
  });

  it('creates an EMAIL row as PENDING and enqueues delivery with the new row ID', async () => {
    const repo = createMockRepository();
    const notification = createMockNotification({ id: 'email-notification-id', channel: NotificationChannel.EMAIL, status: NotificationStatus.PENDING });
    repo.create.mockResolvedValue(notification);

    const service = new NotificationDispatchService(repo as unknown as NotificationRepository);
    await service.send({
      tenantId: TENANT_ID,
      userId: USER_ID,
      title: 'GST return due',
      message: 'Your GSTR-3B is due in 3 days.',
      channels: [NotificationChannel.EMAIL],
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ channel: NotificationChannel.EMAIL, status: NotificationStatus.PENDING }),
      { tenantId: TENANT_ID },
    );
    expect(addMock).toHaveBeenCalledWith('deliver', { notificationId: 'email-notification-id' });
  });

  it('creates one row per requested channel', async () => {
    const repo = createMockRepository();
    repo.create
      .mockResolvedValueOnce(createMockNotification({ id: 'in-app-id', channel: NotificationChannel.IN_APP }))
      .mockResolvedValueOnce(createMockNotification({ id: 'email-id', channel: NotificationChannel.EMAIL, status: NotificationStatus.PENDING }))
      .mockResolvedValueOnce(createMockNotification({ id: 'whatsapp-id', channel: NotificationChannel.WHATSAPP, status: NotificationStatus.PENDING }));

    const service = new NotificationDispatchService(repo as unknown as NotificationRepository);
    const result = await service.send({
      tenantId: TENANT_ID,
      userId: USER_ID,
      title: 'Payment reminder',
      message: 'Invoice INV-001 is overdue.',
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.WHATSAPP],
    });

    expect(repo.create).toHaveBeenCalledTimes(3);
    expect(addMock).toHaveBeenCalledTimes(2);
    expect(addMock).toHaveBeenCalledWith('deliver', { notificationId: 'email-id' });
    expect(addMock).toHaveBeenCalledWith('deliver', { notificationId: 'whatsapp-id' });
    expect(result).toHaveLength(3);
  });
});
