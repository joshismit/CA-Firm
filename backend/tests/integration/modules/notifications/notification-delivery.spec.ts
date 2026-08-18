/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Notification Delivery — Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the REAL pipeline end-to-end: NotificationDispatchService (real
 * Postgres write + real BullMQ `.add()` against the real local Redis this
 * dev environment has running) → a real `createNotificationWorker()`
 * instance actually consuming the queue → the real `EmailProvider`/
 * `WhatsAppProvider` → `Notification.status` resolved back in Postgres.
 *
 * Only `mailTransport.sendMail` is mocked — this environment's `.env` has no
 * real SMTP relay configured (`MAIL_HOST` defaults to `localhost`, nothing
 * listens there), so a real send would just hang/fail on a connection
 * refused, not prove anything about this feature's own logic. Everything
 * else (queue, worker, DB) is real. WhatsApp is exercised with NO mock at
 * all — proving the real "not configured" path resolves a real `FAILED` row,
 * exactly as it will in production until real credentials are added.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.mock('@config/mail', () => ({
  mailTransport: { sendMail: jest.fn() },
  mailConfig: { from: '"CA Firm ERP" <noreply@cafirm.com>', defaults: { replyTo: 'noreply@cafirm.com' } },
}));

import { Worker } from 'bullmq';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { prisma } from '@config/database';
import { mailTransport } from '@config/mail';
import { NotificationDispatchService } from '@modules/notifications';
import { createNotificationWorker } from '../../../../src/workers/notification.worker';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';

const sendMailMock = mailTransport.sendMail as jest.Mock;

/** Polls until `Notification.status` leaves PENDING or the timeout elapses — the worker processes asynchronously off a real queue, so there's no synchronous "await this and it's done" call. */
async function waitForResolvedStatus(notificationId: string, timeoutMs = 10000): Promise<NotificationStatus> {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition -- bounded by the timeout check inside the loop.
  while (true) {
    const row = await prisma.notification.findUniqueOrThrow({ where: { id: notificationId } });
    if (row.status !== NotificationStatus.PENDING) return row.status;
    if (Date.now() - start > timeoutMs) throw new Error(`Notification ${notificationId} still PENDING after ${timeoutMs}ms`);
    // eslint-disable-next-line no-await-in-loop -- deliberate poll delay, not a batch of concurrent work.
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

describe('Notification delivery — integration', () => {
  jest.setTimeout(30000);

  let fixtures: TestFixtures;
  let worker: Worker;

  beforeAll(async () => {
    fixtures = await seedFixtures(prisma);
    // The fixture user has no phone by default (see fixtures.ts) — set one so a WHATSAPP send
    // reaches the real WhatsAppProvider (and its real "not configured" branch) instead of
    // failing earlier on "no phone on file", which is a different code path already unit-tested.
    await prisma.user.update({ where: { id: fixtures.tenantA.userId }, data: { phone: '+919876543210' } });
    worker = createNotificationWorker();
  });

  afterAll(async () => {
    // Deliberately does NOT close `notificationQueue` (the shared `@config/queue` singleton) —
    // doing so hung this suite's teardown, since the same underlying `redis` connection is a
    // process-wide singleton other code may still reference. Closing only this test's own
    // `Worker` is sufficient; the resulting "worker process failed to exit gracefully" Jest
    // warning is expected (the shared Redis connection intentionally outlives this file) and
    // does not indicate a leak in this feature's own code.
    await worker.close();
    await prisma.notification.deleteMany({ where: { userId: fixtures.tenantA.userId } });
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  beforeEach(() => {
    sendMailMock.mockReset();
  });

  it('delivers an EMAIL notification through the real worker and resolves it to SENT', async () => {
    sendMailMock.mockResolvedValue({ messageId: 'msg-real-worker-test' });

    const service = new NotificationDispatchService();
    const [notification] = await service.send({
      tenantId: fixtures.tenantA.tenantId,
      userId: fixtures.tenantA.userId,
      title: 'GST return due',
      message: 'Your GSTR-3B is due in 3 days.',
      channels: [NotificationChannel.EMAIL],
    });

    expect(notification.status).toBe(NotificationStatus.PENDING);

    const finalStatus = await waitForResolvedStatus(notification.id);

    expect(finalStatus).toBe(NotificationStatus.SENT);
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'GST return due', text: 'Your GSTR-3B is due in 3 days.' }),
    );
  });

  it('resolves a WHATSAPP notification to FAILED — real "not configured" path, no mock involved', async () => {
    const service = new NotificationDispatchService();
    const [notification] = await service.send({
      tenantId: fixtures.tenantA.tenantId,
      userId: fixtures.tenantA.userId,
      title: 'Payment reminder',
      message: 'Invoice INV-001 is overdue.',
      channels: [NotificationChannel.WHATSAPP],
    });

    const finalStatus = await waitForResolvedStatus(notification.id);

    expect(finalStatus).toBe(NotificationStatus.FAILED);
  });

  it('creates an IN_APP notification as SENT immediately, with no queue round-trip needed', async () => {
    const service = new NotificationDispatchService();
    const [notification] = await service.send({
      tenantId: fixtures.tenantA.tenantId,
      userId: fixtures.tenantA.userId,
      title: 'Task assigned',
      message: 'You have been assigned a new task.',
      channels: [NotificationChannel.IN_APP],
    });

    expect(notification.status).toBe(NotificationStatus.SENT);
  });
});
