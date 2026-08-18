import { Notification, NotificationChannel, NotificationStatus, NotificationPriority } from '@prisma/client';

/** See the identical comment in tests/unit/modules/contacts/contact.service.spec.ts for why @config/database is stubbed. */
jest.mock('@config/database', () => ({ prisma: {} }));
jest.mock('@config/queue', () => ({ notificationQueue: { add: jest.fn(), getJob: jest.fn() } }));

import { notificationQueue } from '@config/queue';
import { NotificationDispatchService } from '@modules/notifications/service/notification-dispatch.service';
import { NotificationRepository } from '@modules/notifications/repository/notification.repository';
import { NotificationPreferenceResolver } from '@modules/notifications/service/notification-preference-resolver';
import { NotificationTemplateRenderer } from '@modules/notifications/service/notification-template-renderer';
import { AuditLogRecorder } from '@modules/audit/service/audit-log.recorder';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * NotificationDispatchService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Every collaborator is fully mocked — exercises only this service's own
 * branching: `IN_APP` is created `SENT` and never enqueued/preference-filtered;
 * every other channel is preference-checked, created `PENDING`, and enqueued
 * with the new row's ID.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';

const addMock = notificationQueue.add as jest.Mock;

function createMockRepository(): { create: jest.Mock; findRecentByDedupeKey: jest.Mock; findById: jest.Mock; update: jest.Mock } {
  return { create: jest.fn(), findRecentByDedupeKey: jest.fn(), findById: jest.fn(), update: jest.fn() };
}

/** Always allows — the preference/quiet-hours/mute branching itself is covered by `notification-preference-resolver.spec.ts`, not re-tested here. */
function createAllowingPreferenceResolver(): NotificationPreferenceResolver {
  return { resolve: jest.fn().mockResolvedValue({ allowed: true }) } as unknown as NotificationPreferenceResolver;
}

function createNoopAuditLogRecorder(): AuditLogRecorder {
  return { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditLogRecorder;
}

function createUnusedTemplateRenderer(): NotificationTemplateRenderer {
  return { render: jest.fn() } as unknown as NotificationTemplateRenderer;
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
    retryCount: 0,
    providerMessageId: null,
    providerResponse: null,
    sentAt: null,
    deliveredAt: null,
    readAt: null,
    scheduledFor: null,
    priority: NotificationPriority.NORMAL,
    dedupeKey: null,
    cancelledAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

function createService(repo: ReturnType<typeof createMockRepository>): NotificationDispatchService {
  return new NotificationDispatchService(
    repo as unknown as NotificationRepository,
    createAllowingPreferenceResolver(),
    createUnusedTemplateRenderer(),
    createNoopAuditLogRecorder(),
  );
}

describe('NotificationDispatchService', () => {
  beforeEach(() => {
    addMock.mockReset();
  });

  it('creates an IN_APP row as SENT and never touches the queue', async () => {
    const repo = createMockRepository();
    const notification = createMockNotification();
    repo.create.mockResolvedValue(notification);

    const service = createService(repo);
    const result = await service.send({
      tenantId: TENANT_ID,
      userId: USER_ID,
      title: 'Task assigned',
      message: 'You have a new task.',
      channels: [NotificationChannel.IN_APP],
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        channel: NotificationChannel.IN_APP,
        title: 'Task assigned',
        message: 'You have a new task.',
        status: NotificationStatus.SENT,
      }),
      { tenantId: TENANT_ID },
    );
    expect(addMock).not.toHaveBeenCalled();
    expect(result).toEqual([notification]);
  });

  it('creates an EMAIL row as PENDING and enqueues delivery with the new row ID', async () => {
    const repo = createMockRepository();
    const notification = createMockNotification({ id: 'email-notification-id', channel: NotificationChannel.EMAIL, status: NotificationStatus.PENDING });
    repo.create.mockResolvedValue(notification);

    const service = createService(repo);
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
    expect(addMock).toHaveBeenCalledWith(
      'deliver',
      { notificationId: 'email-notification-id' },
      expect.objectContaining({ jobId: 'email-notification-id' }),
    );
  });

  it('creates one row per requested channel', async () => {
    const repo = createMockRepository();
    repo.create
      .mockResolvedValueOnce(createMockNotification({ id: 'in-app-id', channel: NotificationChannel.IN_APP }))
      .mockResolvedValueOnce(createMockNotification({ id: 'email-id', channel: NotificationChannel.EMAIL, status: NotificationStatus.PENDING }))
      .mockResolvedValueOnce(createMockNotification({ id: 'whatsapp-id', channel: NotificationChannel.WHATSAPP, status: NotificationStatus.PENDING }));

    const service = createService(repo);
    const result = await service.send({
      tenantId: TENANT_ID,
      userId: USER_ID,
      title: 'Payment reminder',
      message: 'Invoice INV-001 is overdue.',
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.WHATSAPP],
    });

    expect(repo.create).toHaveBeenCalledTimes(3);
    expect(addMock).toHaveBeenCalledTimes(2);
    expect(addMock).toHaveBeenCalledWith('deliver', { notificationId: 'email-id' }, expect.objectContaining({ jobId: 'email-id' }));
    expect(addMock).toHaveBeenCalledWith('deliver', { notificationId: 'whatsapp-id' }, expect.objectContaining({ jobId: 'whatsapp-id' }));
    expect(result).toHaveLength(3);
  });

  it('skips a channel entirely when the preference resolver disallows it with no reschedule', async () => {
    const repo = createMockRepository();
    const disallowingResolver = { resolve: jest.fn().mockResolvedValue({ allowed: false }) } as unknown as NotificationPreferenceResolver;
    const service = new NotificationDispatchService(
      repo as unknown as NotificationRepository,
      disallowingResolver,
      createUnusedTemplateRenderer(),
      createNoopAuditLogRecorder(),
    );

    const result = await service.send({
      tenantId: TENANT_ID,
      userId: USER_ID,
      title: 'Payment reminder',
      message: 'Invoice INV-001 is overdue.',
      channels: [NotificationChannel.EMAIL],
    });

    expect(repo.create).not.toHaveBeenCalled();
    expect(addMock).not.toHaveBeenCalled();
    expect(result).toHaveLength(0);
  });

  it('returns the existing row instead of creating a duplicate when dedupeKey matches a recent non-terminal notification', async () => {
    const repo = createMockRepository();
    const existing = createMockNotification({ id: 'existing-id', channel: NotificationChannel.EMAIL, status: NotificationStatus.PENDING });
    repo.findRecentByDedupeKey.mockResolvedValue(existing);

    const service = createService(repo);
    const result = await service.send({
      tenantId: TENANT_ID,
      userId: USER_ID,
      title: 'Payment reminder',
      message: 'Invoice INV-001 is overdue.',
      channels: [NotificationChannel.EMAIL],
      dedupeKey: 'invoice-INV-001-overdue',
    });

    expect(repo.create).not.toHaveBeenCalled();
    expect(addMock).not.toHaveBeenCalled();
    expect(result).toEqual([existing]);
  });

  describe('cancel', () => {
    it('returns false when the notification is not PENDING', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockNotification({ status: NotificationStatus.SENT }));

      const service = createService(repo);
      const cancelled = await service.cancel('notification-id', { tenantId: TENANT_ID });

      expect(cancelled).toBe(false);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('removes the queued job and marks the row CANCELLED when PENDING', async () => {
      const repo = createMockRepository();
      repo.findById.mockResolvedValue(createMockNotification({ status: NotificationStatus.PENDING }));
      const removeMock = jest.fn().mockResolvedValue(undefined);
      (notificationQueue.getJob as jest.Mock).mockResolvedValue({ remove: removeMock });

      const service = createService(repo);
      const cancelled = await service.cancel('notification-id', { tenantId: TENANT_ID });

      expect(cancelled).toBe(true);
      expect(removeMock).toHaveBeenCalled();
      expect(repo.update).toHaveBeenCalledWith(
        'notification-id',
        expect.objectContaining({ status: NotificationStatus.CANCELLED }),
        { tenantId: TENANT_ID },
      );
    });
  });
});
