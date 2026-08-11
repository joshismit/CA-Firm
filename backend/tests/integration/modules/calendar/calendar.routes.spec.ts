import { Application } from 'express';
import request from 'supertest';
import { prisma } from '@config/database';
import { UserRole } from '@shared/enums';
import { TaskStatus, AuditEventType } from '@prisma/client';
import { createCalendarTestApp } from '../../helpers/calendar-test-app';
import { signAccessToken } from '../../helpers/jwt';
import { seedFixtures, cleanupFixtures, TestFixtures } from '../../helpers/fixtures';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Work Calendar API — Integration Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the full real request lifecycle against a real database:
 *   Request → authMiddleware (JWT) → tenantMiddleware → requireRole →
 *   validate (Zod) → CalendarController → CalendarAggregationService/
 *   CalendarEventService → real TaskService/CalendarEventRepository →
 *   Postgres.
 * ─────────────────────────────────────────────────────────────────────────────
 */
jest.setTimeout(30000);

describe('Work Calendar API — integration', () => {
  let app: Application;
  let fixtures: TestFixtures;
  let taskInRangeId: string;
  let taskOutOfRangeId: string;

  const RANGE_FROM = new Date('2026-08-01T00:00:00.000Z');
  const RANGE_TO = new Date('2026-08-31T23:59:59.999Z');

  beforeAll(async () => {
    app = createCalendarTestApp();
    fixtures = await seedFixtures(prisma);

    const [inRange, outOfRange] = await Promise.all([
      prisma.task.create({
        data: {
          tenantId: fixtures.tenantA.tenantId,
          title: 'File GST return',
          assigneeId: fixtures.tenantA.userId,
          status: TaskStatus.TODO,
          dueDate: new Date('2026-08-15T00:00:00.000Z'),
        },
      }),
      prisma.task.create({
        data: {
          tenantId: fixtures.tenantA.tenantId,
          title: 'File next quarter return',
          assigneeId: fixtures.tenantA.userId,
          status: TaskStatus.TODO,
          dueDate: new Date('2026-11-15T00:00:00.000Z'),
        },
      }),
    ]);
    taskInRangeId = inRange.id;
    taskOutOfRangeId = outOfRange.id;
  });

  afterAll(async () => {
    await prisma.task.deleteMany({ where: { id: { in: [taskInRangeId, taskOutOfRangeId] } } });
    // CalendarEvent/CalendarEventAttendee rows created by fixture users cascade-delete when
    // their creator User row is removed below (`onDelete: Cascade` on `createdById`/`userId`) —
    // explicit here anyway for a clean, order-independent teardown.
    await prisma.calendarEvent.deleteMany({ where: { tenantId: { in: [fixtures.tenantA.tenantId, fixtures.tenantB.tenantId] } } });
    await prisma.auditLog.deleteMany({ where: { tenantId: { in: [fixtures.tenantA.tenantId, fixtures.tenantB.tenantId] } } });
    await cleanupFixtures(prisma, fixtures);
    await prisma.$disconnect();
  });

  function tokenFor(userId: string, tenantId: string, role: UserRole): string {
    return signAccessToken({ userId, tenantId, role, permissions: [] });
  }

  function authedGet(path: string, userId: string, tenantId: string, role: UserRole) {
    return request(app).get(path).set('Authorization', `Bearer ${tokenFor(userId, tenantId, role)}`);
  }

  describe('authentication and role gating', () => {
    it('returns 401 when no Authorization header is present', async () => {
      const res = await request(app).get(`/api/v1/calendar?from=${RANGE_FROM.toISOString()}&to=${RANGE_TO.toISOString()}`);
      expect(res.status).toBe(401);
    });

    it('TENANT_ADMIN/MANAGER/STAFF can all reach the calendar', async () => {
      for (const role of [UserRole.TENANT_ADMIN, UserRole.MANAGER, UserRole.STAFF]) {
        const res = await authedGet(
          `/api/v1/calendar?from=${RANGE_FROM.toISOString()}&to=${RANGE_TO.toISOString()}`,
          fixtures.tenantA.userId,
          fixtures.tenantA.tenantId,
          role,
        );
        expect(res.status).toBe(200);
      }
    });

    it('CLIENT role is rejected with 403 (no client-portal calendar exists)', async () => {
      const res = await authedGet(
        `/api/v1/calendar?from=${RANGE_FROM.toISOString()}&to=${RANGE_TO.toISOString()}`,
        fixtures.tenantA.clientPortalUserId,
        fixtures.tenantA.tenantId,
        UserRole.CLIENT,
      );
      expect(res.status).toBe(403);
    });

    it('missing from/to returns 422', async () => {
      const res = await authedGet('/api/v1/calendar', fixtures.tenantA.userId, fixtures.tenantA.tenantId, UserRole.TENANT_ADMIN);
      expect(res.status).toBe(422);
    });
  });

  describe('GET /calendar — date-range filtering', () => {
    it('includes a task due inside the range and excludes one due outside it', async () => {
      const res = await authedGet(
        `/api/v1/calendar?from=${RANGE_FROM.toISOString()}&to=${RANGE_TO.toISOString()}&scope=firm`,
        fixtures.tenantA.userId,
        fixtures.tenantA.tenantId,
        UserRole.TENANT_ADMIN,
      );

      expect(res.status).toBe(200);
      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(taskInRangeId);
      expect(ids).not.toContain(taskOutOfRangeId);

      const taskItem = res.body.data.items.find((item: { id: string }) => item.id === taskInRangeId);
      expect(taskItem).toMatchObject({ source: 'TASK', calendarState: 'UPCOMING', status: 'TODO' });
    });
  });

  describe('GET /calendar — scope=mine vs scope=firm', () => {
    it('scope=firm requested by STAFF returns 403', async () => {
      const res = await authedGet(
        `/api/v1/calendar?from=${RANGE_FROM.toISOString()}&to=${RANGE_TO.toISOString()}&scope=firm`,
        fixtures.tenantA.userId,
        fixtures.tenantA.tenantId,
        UserRole.STAFF,
      );
      expect(res.status).toBe(403);
    });

    it("scope=mine for a staff member who isn't the assignee never returns the other staff member's task", async () => {
      const res = await authedGet(
        `/api/v1/calendar?from=${RANGE_FROM.toISOString()}&to=${RANGE_TO.toISOString()}&scope=mine`,
        fixtures.tenantA.staffUserId,
        fixtures.tenantA.tenantId,
        UserRole.STAFF,
      );

      expect(res.status).toBe(200);
      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).not.toContain(taskInRangeId);
    });

    it('scope=mine for the actual assignee returns their own task', async () => {
      const res = await authedGet(
        `/api/v1/calendar?from=${RANGE_FROM.toISOString()}&to=${RANGE_TO.toISOString()}&scope=mine`,
        fixtures.tenantA.userId,
        fixtures.tenantA.tenantId,
        UserRole.STAFF,
      );

      expect(res.status).toBe(200);
      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(taskInRangeId);
    });
  });

  describe('tenant isolation', () => {
    it("tenant B's calendar never reflects tenant A's seeded task", async () => {
      const res = await authedGet(
        `/api/v1/calendar?from=${RANGE_FROM.toISOString()}&to=${RANGE_TO.toISOString()}&scope=firm`,
        fixtures.tenantB.userId,
        fixtures.tenantB.tenantId,
        UserRole.TENANT_ADMIN,
      );

      expect(res.status).toBe(200);
      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).not.toContain(taskInRangeId);
    });
  });

  describe('CalendarEvent CRUD + audit log', () => {
    let eventId: string;

    it('creates an event and records CALENDAR_EVENT_CREATED', async () => {
      const res = await request(app)
        .post('/api/v1/calendar/events')
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.userId, fixtures.tenantA.tenantId, UserRole.STAFF)}`)
        .send({
          title: 'Client Meeting',
          eventType: 'CLIENT_MEETING',
          startAt: '2026-08-12T05:30:00.000Z',
          endAt: '2026-08-12T06:00:00.000Z',
          businessId: fixtures.tenantA.businessId,
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        title: 'Client Meeting',
        eventType: 'CLIENT_MEETING',
        business: { id: fixtures.tenantA.businessId },
      });
      eventId = res.body.data.id;

      const auditRows = await prisma.auditLog.findMany({
        where: { tenantId: fixtures.tenantA.tenantId, eventType: AuditEventType.CALENDAR_EVENT_CREATED, targetId: eventId },
      });
      expect(auditRows).toHaveLength(1);
    });

    it('the created event now appears in GET /calendar for its creator', async () => {
      const res = await authedGet(
        `/api/v1/calendar?from=${RANGE_FROM.toISOString()}&to=${RANGE_TO.toISOString()}&scope=mine`,
        fixtures.tenantA.userId,
        fixtures.tenantA.tenantId,
        UserRole.STAFF,
      );
      expect(res.status).toBe(200);
      const item = res.body.data.items.find((i: { id: string }) => i.id === eventId);
      expect(item).toMatchObject({ source: 'EVENT', calendarState: 'UPCOMING' });
    });

    it('a non-creator STAFF member cannot update the event (403)', async () => {
      const res = await request(app)
        .patch(`/api/v1/calendar/events/${eventId}`)
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.staffUserId, fixtures.tenantA.tenantId, UserRole.STAFF)}`)
        .send({ title: 'Hijacked title' });

      expect(res.status).toBe(403);
    });

    it('the creator can update the event and CALENDAR_EVENT_UPDATED is recorded', async () => {
      const res = await request(app)
        .patch(`/api/v1/calendar/events/${eventId}`)
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.userId, fixtures.tenantA.tenantId, UserRole.STAFF)}`)
        .send({ title: 'Client Meeting (Rescheduled)' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Client Meeting (Rescheduled)');

      const auditRows = await prisma.auditLog.findMany({
        where: { tenantId: fixtures.tenantA.tenantId, eventType: AuditEventType.CALENDAR_EVENT_UPDATED, targetId: eventId },
      });
      expect(auditRows).toHaveLength(1);
    });

    it('an unrestricted role (TENANT_ADMIN) may update an event they did not create', async () => {
      const res = await request(app)
        .patch(`/api/v1/calendar/events/${eventId}`)
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.staffUserId, fixtures.tenantA.tenantId, UserRole.TENANT_ADMIN)}`)
        .send({ location: 'Conference Room A' });

      expect(res.status).toBe(200);
      expect(res.body.data.location).toBe('Conference Room A');
    });

    it('a non-creator STAFF member cannot delete the event (403)', async () => {
      const res = await request(app)
        .delete(`/api/v1/calendar/events/${eventId}`)
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.staffUserId, fixtures.tenantA.tenantId, UserRole.STAFF)}`);

      expect(res.status).toBe(403);
    });

    it('the creator can delete the event and CALENDAR_EVENT_DELETED is recorded', async () => {
      const res = await request(app)
        .delete(`/api/v1/calendar/events/${eventId}`)
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.userId, fixtures.tenantA.tenantId, UserRole.STAFF)}`);

      expect(res.status).toBe(200);

      const auditRows = await prisma.auditLog.findMany({
        where: { tenantId: fixtures.tenantA.tenantId, eventType: AuditEventType.CALENDAR_EVENT_DELETED, targetId: eventId },
      });
      expect(auditRows).toHaveLength(1);

      const getRes = await request(app)
        .get(`/api/v1/calendar/events/${eventId}`)
        .set('Authorization', `Bearer ${tokenFor(fixtures.tenantA.userId, fixtures.tenantA.tenantId, UserRole.STAFF)}`);
      expect(getRes.status).toBe(404);
    });
  });
});
