import { randomUUID } from 'crypto';
import request from 'supertest';
import { Application } from 'express';
import { NotificationChannel, NotificationStatus, UserStatus } from '@prisma/client';
import { prisma } from '@config/database';
import { createNotificationTestApp } from '../../helpers/notification-test-app';
import { signAccessToken } from '../../helpers/jwt';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Notifications API — Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the full real request lifecycle against a real database:
 *   Request → authMiddleware (JWT) → tenantMiddleware → validate (Zod) →
 *   NotificationController → NotificationService → NotificationRepository →
 *   Postgres.
 *
 * There is no create endpoint (notifications are system-generated), so
 * every `Notification` row this suite needs is seeded directly via Prisma —
 * mirrors how the Roles/Permissions suites seed rows their tests need with
 * no HTTP creation path of their own. A second user is created within
 * tenant A specifically to prove ownership scoping: same tenant, different
 * owner, must still be invisible/inaccessible.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

describe('Notifications API — integration', () => {
  let app: Application;
  let fixtures: TestFixtures;
  let otherUserInTenantAId: string;
  let ownNotificationId: string;
  let otherUserNotificationId: string;

  beforeAll(async () => {
    app = createNotificationTestApp();
    fixtures = await seedFixtures(prisma);

    const suffix = randomUUID().slice(0, 8);
    const otherUser = await prisma.user.create({
      data: {
        tenantId: fixtures.tenantA.tenantId,
        email: `other.${suffix}@example.test`,
        firstName: 'Other',
        lastName: 'User',
        status: UserStatus.ACTIVE,
      },
    });
    otherUserInTenantAId = otherUser.id;

    const own = await prisma.notification.create({
      data: {
        tenantId: fixtures.tenantA.tenantId,
        userId: fixtures.tenantA.userId,
        channel: NotificationChannel.IN_APP,
        status: NotificationStatus.DELIVERED,
        title: 'Task assigned to you',
        message: 'Review the Q1 GST filing.',
        isRead: false,
      },
    });
    ownNotificationId = own.id;

    const otherUsers = await prisma.notification.create({
      data: {
        tenantId: fixtures.tenantA.tenantId,
        userId: otherUserInTenantAId,
        channel: NotificationChannel.EMAIL,
        status: NotificationStatus.SENT,
        title: 'A notification for someone else',
        message: 'This belongs to a different user in the same tenant.',
        isRead: false,
      },
    });
    otherUserNotificationId = otherUsers.id;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { tenantId: { in: [fixtures.tenantA.tenantId, fixtures.tenantB.tenantId] } } });
    await prisma.user.deleteMany({ where: { id: otherUserInTenantAId } });
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  function tokenForTenantA(permissions: string[] = []): string {
    return signAccessToken({ userId: fixtures.tenantA.userId, tenantId: fixtures.tenantA.tenantId, permissions });
  }

  function tokenForOtherUserInTenantA(): string {
    return signAccessToken({ userId: otherUserInTenantAId, tenantId: fixtures.tenantA.tenantId, permissions: [] });
  }

  function tokenForTenantB(): string {
    return signAccessToken({ userId: fixtures.tenantB.userId, tenantId: fixtures.tenantB.tenantId, permissions: [] });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Authentication middleware / no permission gating
  // ────────────────────────────────────────────────────────────────────────
  describe('authentication middleware and no permission gating', () => {
    it('returns 401 when no Authorization header is present', async () => {
      const res = await request(app).get('/api/v1/notifications');
      expect(res.status).toBe(401);
    });

    it('succeeds on GET /notifications for a token with zero permissions (self-service, ungated)', async () => {
      const res = await request(app).get('/api/v1/notifications').set('Authorization', `Bearer ${tokenForTenantA([])}`);
      expect(res.status).toBe(200);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Validation middleware
  // ────────────────────────────────────────────────────────────────────────
  describe('validation middleware', () => {
    it('returns 422 for an invalid path param (non-UUID id)', async () => {
      const res = await request(app).get('/api/v1/notifications/not-a-uuid').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(422);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Reads: list / filters / search / ownership
  // ────────────────────────────────────────────────────────────────────────
  describe('reads', () => {
    it('GET /notifications returns only the caller\'s own notifications, excluding another user\'s in the same tenant', async () => {
      const res = await request(app).get('/api/v1/notifications').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.map((n: { id: string }) => n.id);
      expect(ids).toContain(ownNotificationId);
      expect(ids).not.toContain(otherUserNotificationId);
    });

    it('GET /notifications searches by title/message', async () => {
      const res = await request(app)
        .get('/api/v1/notifications')
        .query({ search: 'GST filing' })
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.map((n: { id: string }) => n.id);
      expect(ids).toContain(ownNotificationId);
    });

    it('GET /notifications filters by channel', async () => {
      const res = await request(app)
        .get('/api/v1/notifications')
        .query({ channel: 'IN_APP' })
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      expect(res.body.data.every((n: { channel: string }) => n.channel === 'IN_APP')).toBe(true);
    });

    it('GET /notifications filters by unreadOnly', async () => {
      const res = await request(app)
        .get('/api/v1/notifications')
        .query({ unreadOnly: true })
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      expect(res.body.data.every((n: { isRead: boolean }) => n.isRead === false)).toBe(true);
    });

    it("GET /notifications/:id returns 200 for the caller's own notification", async () => {
      const res = await request(app).get(`/api/v1/notifications/${ownNotificationId}`).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(ownNotificationId);
    });

    it("GET /notifications/:id returns 404 for another user's notification in the same tenant (ownership, not just tenant, scoping)", async () => {
      const res = await request(app).get(`/api/v1/notifications/${otherUserNotificationId}`).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(404);
    });

    it('GET /notifications/:id returns 404 for a well-formed but unknown id', async () => {
      const res = await request(app).get(`/api/v1/notifications/${randomUUID()}`).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(404);
    });

    it("the other user (same tenant) can see their own notification via their own token", async () => {
      const res = await request(app).get(`/api/v1/notifications/${otherUserNotificationId}`).set('Authorization', `Bearer ${tokenForOtherUserInTenantA()}`);
      expect(res.status).toBe(200);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Mark as read (single + ownership)
  // ────────────────────────────────────────────────────────────────────────
  describe('mark as read', () => {
    it("PATCH /notifications/:id/read returns 404 for another user's notification", async () => {
      const res = await request(app)
        .patch(`/api/v1/notifications/${otherUserNotificationId}/read`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(404);

      const stillUnread = await prisma.notification.findUniqueOrThrow({ where: { id: otherUserNotificationId } });
      expect(stillUnread.isRead).toBe(false);
    });

    it('PATCH /notifications/:id/read returns 200 and marks the notification read', async () => {
      const res = await request(app)
        .patch(`/api/v1/notifications/${ownNotificationId}/read`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);

      const updated = await prisma.notification.findUniqueOrThrow({ where: { id: ownNotificationId } });
      expect(updated.isRead).toBe(true);
    });

    it('PATCH /notifications/:id/read is idempotent on an already-read notification', async () => {
      const res = await request(app)
        .patch(`/api/v1/notifications/${ownNotificationId}/read`)
        .set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Mark all as read (bulk, scoped to caller only)
  // ────────────────────────────────────────────────────────────────────────
  describe('mark all as read', () => {
    let bulkNotificationId: string;

    beforeAll(async () => {
      const created = await prisma.notification.create({
        data: {
          tenantId: fixtures.tenantA.tenantId,
          userId: fixtures.tenantA.userId,
          channel: NotificationChannel.SMS,
          status: NotificationStatus.DELIVERED,
          title: 'Bulk read test',
          message: 'Should be marked read by read-all.',
          isRead: false,
        },
      });
      bulkNotificationId = created.id;
    });

    it("POST /notifications/read-all marks the caller's unread notifications read but not another user's", async () => {
      const res = await request(app).post('/api/v1/notifications/read-all').set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);

      const own = await prisma.notification.findUniqueOrThrow({ where: { id: bulkNotificationId } });
      expect(own.isRead).toBe(true);

      const other = await prisma.notification.findUniqueOrThrow({ where: { id: otherUserNotificationId } });
      expect(other.isRead).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Delete (ownership)
  // ────────────────────────────────────────────────────────────────────────
  describe('delete', () => {
    it("DELETE /notifications/:id returns 404 for another user's notification", async () => {
      const res = await request(app).delete(`/api/v1/notifications/${otherUserNotificationId}`).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(404);
    });

    it('DELETE /notifications/:id returns 200 and soft-deletes the notification', async () => {
      const res = await request(app).delete(`/api/v1/notifications/${ownNotificationId}`).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(200);
    });

    it('GET /notifications/:id returns 404 once soft-deleted', async () => {
      const res = await request(app).get(`/api/v1/notifications/${ownNotificationId}`).set('Authorization', `Bearer ${tokenForTenantA()}`);
      expect(res.status).toBe(404);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Tenant isolation
  // ────────────────────────────────────────────────────────────────────────
  describe('tenant isolation', () => {
    it("returns 404 when tenant B requests tenant A's notification by id", async () => {
      const res = await request(app).get(`/api/v1/notifications/${otherUserNotificationId}`).set('Authorization', `Bearer ${tokenForTenantB()}`);
      expect(res.status).toBe(404);
    });

    it("does not include tenant A's notifications in tenant B's list", async () => {
      const res = await request(app).get('/api/v1/notifications').set('Authorization', `Bearer ${tokenForTenantB()}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.map((n: { id: string }) => n.id);
      expect(ids).not.toContain(otherUserNotificationId);
    });
  });
});
