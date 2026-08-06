import { randomUUID } from 'crypto';
import request from 'supertest';
import { Application } from 'express';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { prisma } from '@config/database';
import { createNotificationTestApp } from '../../helpers/notification-test-app';
import { signAccessToken } from '../../helpers/jwt';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Notifications Admin API — Integration Tests (PRD §11)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Covers the tenant-wide admin surfaces added alongside the personal inbox
 * (already covered by `notification.routes.spec.ts`): dashboard, history,
 * send/schedule/test/cancel, templates, firm settings, and provider health.
 * Every route here is `requirePermission()`-gated — the primary thing this
 * suite proves is that gate actually works (403 without the permission, 2xx
 * with it), plus that `send`/`schedule`/`cancel` actually persist real rows.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

describe('Notifications Admin API — integration', () => {
  let app: Application;
  let fixtures: TestFixtures;

  beforeAll(async () => {
    app = createNotificationTestApp();
    fixtures = await seedFixtures(prisma);
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { tenantId: { in: [fixtures.tenantA.tenantId, fixtures.tenantB.tenantId] } } });
    await prisma.notificationTemplate.deleteMany({ where: { tenantId: fixtures.tenantA.tenantId } });
    await prisma.notificationPreference.deleteMany({ where: { tenantId: { in: [fixtures.tenantA.tenantId, fixtures.tenantB.tenantId] } } });
    await prisma.firmNotificationSettings.deleteMany({ where: { tenantId: { in: [fixtures.tenantA.tenantId, fixtures.tenantB.tenantId] } } });
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  function tokenWithPermissions(permissions: string[]): string {
    return signAccessToken({ userId: fixtures.tenantA.userId, tenantId: fixtures.tenantA.tenantId, permissions });
  }

  const NO_PERMS = tokenWithPermissions;

  // ────────────────────────────────────────────────────────────────────────
  // Dashboard
  // ────────────────────────────────────────────────────────────────────────
  describe('GET /notifications/dashboard', () => {
    it('returns 403 without notifications:read', async () => {
      const res = await request(app).get('/api/v1/notifications/dashboard').set('Authorization', `Bearer ${NO_PERMS([])}`);
      expect(res.status).toBe(403);
    });

    it('returns widget data with notifications:read', async () => {
      const res = await request(app)
        .get('/api/v1/notifications/dashboard')
        .set('Authorization', `Bearer ${tokenWithPermissions(['notifications:read'])}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(
        expect.objectContaining({
          unreadCount: expect.any(Number),
          todaysReminders: expect.any(Number),
          upcomingReminders: expect.any(Number),
          failedNotifications: expect.any(Number),
          recentActivity: expect.any(Array),
        }),
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // History
  // ────────────────────────────────────────────────────────────────────────
  describe('GET /notifications/history', () => {
    it('returns 403 without notifications:read', async () => {
      const res = await request(app).get('/api/v1/notifications/history').set('Authorization', `Bearer ${NO_PERMS([])}`);
      expect(res.status).toBe(403);
    });

    it('returns a tenant-wide paginated history with notifications:read', async () => {
      await prisma.notification.create({
        data: {
          tenantId: fixtures.tenantA.tenantId,
          userId: fixtures.tenantA.userId,
          channel: NotificationChannel.EMAIL,
          status: NotificationStatus.SENT,
          title: 'History fixture',
          message: 'Seeded for the history test.',
        },
      });

      const res = await request(app)
        .get('/api/v1/notifications/history')
        .set('Authorization', `Bearer ${tokenWithPermissions(['notifications:read'])}`);
      expect(res.status).toBe(200);
      expect(res.body.data.some((n: { title: string }) => n.title === 'History fixture')).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Send / Schedule / Test / Cancel
  // ────────────────────────────────────────────────────────────────────────
  describe('POST /notifications/send', () => {
    it('returns 403 without notifications:create', async () => {
      const res = await request(app)
        .post('/api/v1/notifications/send')
        .set('Authorization', `Bearer ${NO_PERMS([])}`)
        .send({ userId: fixtures.tenantA.userId, title: 'Test', message: 'Test', channels: ['IN_APP'] });
      expect(res.status).toBe(403);
    });

    it('creates a real IN_APP notification with notifications:create', async () => {
      const res = await request(app)
        .post('/api/v1/notifications/send')
        .set('Authorization', `Bearer ${tokenWithPermissions(['notifications:create'])}`)
        .send({ userId: fixtures.tenantA.userId, title: 'Admin broadcast', message: 'Hello from an admin.', channels: ['IN_APP'] });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].status).toBe('SENT');

      const row = await prisma.notification.findUnique({ where: { id: res.body.data[0].id } });
      expect(row?.title).toBe('Admin broadcast');
    });

    it('returns 422 for an invalid body (missing channels)', async () => {
      const res = await request(app)
        .post('/api/v1/notifications/send')
        .set('Authorization', `Bearer ${tokenWithPermissions(['notifications:create'])}`)
        .send({ userId: fixtures.tenantA.userId, title: 'Test', message: 'Test' });
      expect(res.status).toBe(422);
    });
  });

  describe('POST /notifications/schedule', () => {
    it('creates a PENDING, scheduled IN_APP-excluded... EMAIL notification with a future scheduledFor', async () => {
      const scheduledFor = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const res = await request(app)
        .post('/api/v1/notifications/schedule')
        .set('Authorization', `Bearer ${tokenWithPermissions(['notifications:create'])}`)
        .send({
          userId: fixtures.tenantA.userId,
          title: 'Scheduled reminder',
          message: 'Fires in an hour.',
          channels: ['EMAIL'],
          scheduledFor,
        });

      expect(res.status).toBe(201);
      expect(res.body.data[0].status).toBe('PENDING');

      const row = await prisma.notification.findUnique({ where: { id: res.body.data[0].id } });
      expect(row?.scheduledFor?.toISOString()).toBe(scheduledFor);
    });
  });

  describe('POST /notifications/test', () => {
    it('sends a test notification to the calling admin on the given channel', async () => {
      const res = await request(app)
        .post('/api/v1/notifications/test')
        .set('Authorization', `Bearer ${tokenWithPermissions(['notifications:manage'])}`)
        .send({ channel: 'IN_APP' });

      expect(res.status).toBe(201);
      expect(res.body.data[0].title).toBe('Test notification');
    });

    it('returns 403 with only notifications:create (test requires notifications:manage)', async () => {
      const res = await request(app)
        .post('/api/v1/notifications/test')
        .set('Authorization', `Bearer ${tokenWithPermissions(['notifications:create'])}`)
        .send({ channel: 'IN_APP' });
      expect(res.status).toBe(403);
    });
  });

  describe('POST /notifications/:id/cancel', () => {
    it('cancels a PENDING notification', async () => {
      const pending = await prisma.notification.create({
        data: {
          tenantId: fixtures.tenantA.tenantId,
          userId: fixtures.tenantA.userId,
          channel: NotificationChannel.SMS,
          status: NotificationStatus.PENDING,
          title: 'Cancel me',
          message: 'Should be cancellable.',
        },
      });

      const res = await request(app)
        .post(`/api/v1/notifications/${pending.id}/cancel`)
        .set('Authorization', `Bearer ${tokenWithPermissions(['notifications:manage'])}`);
      expect(res.status).toBe(200);

      const updated = await prisma.notification.findUniqueOrThrow({ where: { id: pending.id } });
      expect(updated.status).toBe('CANCELLED');
      expect(updated.cancelledAt).not.toBeNull();
    });

    it('returns 409 for an already-SENT notification', async () => {
      const sent = await prisma.notification.create({
        data: {
          tenantId: fixtures.tenantA.tenantId,
          userId: fixtures.tenantA.userId,
          channel: NotificationChannel.IN_APP,
          status: NotificationStatus.SENT,
          title: 'Already sent',
          message: 'Cannot be cancelled.',
        },
      });

      const res = await request(app)
        .post(`/api/v1/notifications/${sent.id}/cancel`)
        .set('Authorization', `Bearer ${tokenWithPermissions(['notifications:manage'])}`);
      expect(res.status).toBe(409);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Templates
  // ────────────────────────────────────────────────────────────────────────
  describe('notification templates', () => {
    it('GET /notification-templates returns 403 without notifications:read', async () => {
      const res = await request(app).get('/api/v1/notification-templates').set('Authorization', `Bearer ${NO_PERMS([])}`);
      expect(res.status).toBe(403);
    });

    it('GET /notification-templates includes the seeded global defaults', async () => {
      const res = await request(app)
        .get('/api/v1/notification-templates')
        .set('Authorization', `Bearer ${tokenWithPermissions(['notifications:read'])}`);
      expect(res.status).toBe(200);
      expect(res.body.data.some((t: { key: string }) => t.key === 'user-invitation')).toBe(true);
    });

    it('creates a tenant override, then lists it as isOverridden: true', async () => {
      const key = `custom-key-${randomUUID().slice(0, 8)}`;
      const createRes = await request(app)
        .post('/api/v1/notification-templates')
        .set('Authorization', `Bearer ${tokenWithPermissions(['notifications:manage'])}`)
        .send({ key, channel: 'EMAIL', name: 'Custom', bodyTemplateText: 'Hello {{clientName}}' });
      expect(createRes.status).toBe(201);

      const listRes = await request(app)
        .get('/api/v1/notification-templates')
        .set('Authorization', `Bearer ${tokenWithPermissions(['notifications:read'])}`);
      const created = listRes.body.data.find((t: { key: string }) => t.key === key);
      expect(created).toBeDefined();
      expect(created.isOverridden).toBe(true);
    });

    it('POST /notification-templates returns 403 with only notifications:read', async () => {
      const res = await request(app)
        .post('/api/v1/notification-templates')
        .set('Authorization', `Bearer ${tokenWithPermissions(['notifications:read'])}`)
        .send({ key: 'x', channel: 'EMAIL', name: 'X', bodyTemplateText: 'Y' });
      expect(res.status).toBe(403);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Preferences / firm settings
  // ────────────────────────────────────────────────────────────────────────
  describe('notification settings', () => {
    it('GET /notification-settings (self) succeeds with zero permissions', async () => {
      const res = await request(app).get('/api/v1/notification-settings').set('Authorization', `Bearer ${NO_PERMS([])}`);
      expect(res.status).toBe(200);
      expect(res.body.data.emailEnabled).toBe(true);
    });

    it('PATCH /notification-settings (self) updates and persists the row', async () => {
      const res = await request(app)
        .patch('/api/v1/notification-settings')
        .set('Authorization', `Bearer ${NO_PERMS([])}`)
        .send({ smsEnabled: false });
      expect(res.status).toBe(200);
      expect(res.body.data.smsEnabled).toBe(false);

      const row = await prisma.notificationPreference.findUnique({ where: { userId: fixtures.tenantA.userId } });
      expect(row?.smsEnabled).toBe(false);
    });

    it('GET /notification-settings/firm returns 403 without notifications:read', async () => {
      const res = await request(app).get('/api/v1/notification-settings/firm').set('Authorization', `Bearer ${NO_PERMS([])}`);
      expect(res.status).toBe(403);
    });

    it('PATCH /notification-settings/firm updates the firm-wide row with notifications:manage', async () => {
      const res = await request(app)
        .patch('/api/v1/notification-settings/firm')
        .set('Authorization', `Bearer ${tokenWithPermissions(['notifications:manage'])}`)
        .send({ whatsappEnabled: true });
      expect(res.status).toBe(200);
      expect(res.body.data.whatsappEnabled).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Providers
  // ────────────────────────────────────────────────────────────────────────
  describe('notification providers', () => {
    it('GET /notification-providers returns 403 without notifications:read', async () => {
      const res = await request(app).get('/api/v1/notification-providers').set('Authorization', `Bearer ${NO_PERMS([])}`);
      expect(res.status).toBe(403);
    });

    it('GET /notification-providers lists EMAIL/SMS/WHATSAPP with capabilities', async () => {
      const res = await request(app)
        .get('/api/v1/notification-providers')
        .set('Authorization', `Bearer ${tokenWithPermissions(['notifications:read'])}`);
      expect(res.status).toBe(200);
      const channels = res.body.data.map((p: { channel: string }) => p.channel);
      expect(channels).toEqual(expect.arrayContaining(['EMAIL', 'SMS', 'WHATSAPP']));
      expect(res.body.data.find((p: { channel: string }) => p.channel === 'EMAIL').isConfigured).toBe(true);
    });

    it('GET /notification-providers/health reports a status per channel', async () => {
      const res = await request(app)
        .get('/api/v1/notification-providers/health')
        .set('Authorization', `Bearer ${tokenWithPermissions(['notifications:read'])}`);
      expect(res.status).toBe(200);
      expect(res.body.data.every((p: { health: { status: string } }) => ['up', 'down', 'unconfigured'].includes(p.health.status))).toBe(
        true,
      );
    });
  });
});
