import { Request } from 'express';

/** See the identical comment in tests/unit/modules/dashboard/dashboard-aggregation.service.spec.ts for why @config/database is stubbed. */
jest.mock('@config/database', () => ({ prisma: {} }));

import { TaskStatus } from '@prisma/client';
import { UserRole } from '@shared/enums';
import { CalendarAggregationService } from '@modules/calendar/service/calendar-aggregation.service';
import { TaskService } from '@modules/tasks';
import { CalendarEventService } from '@modules/calendar/service/calendar-event.service';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CalendarAggregationService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Every composed Service is fully mocked, injected via constructor DI —
 * mirrors `tests/unit/modules/dashboard/dashboard-aggregation.service.spec.ts`.
 * Focus: PRD §11 "My Work vs Firm Work" scoping, merge/sort correctness, and
 * the `source` filter skipping the un-requested composed Service entirely.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-22222222-2222-2222-2222-222222222222';

function paginated<T>(data: T[]) {
  return { data, meta: { page: 1, limit: 200, total: data.length, totalPages: 1, hasNextPage: false, hasPrevPage: false } };
}

function createFakeRequest(role: UserRole): Request {
  return {
    tenant: { id: TENANT_ID, slug: 'acme', name: 'Acme & Co', planCode: 'professional', isActive: true },
    user: { id: USER_ID, email: 'staff@acme.test', role, tenantId: TENANT_ID, permissions: [] },
    correlationId: 'test-correlation-id',
  } as unknown as Request;
}

function createMocks() {
  const taskService = {
    searchForCalendar: jest.fn().mockResolvedValue(paginated([])),
  } as unknown as jest.Mocked<TaskService>;
  const calendarEventService = {
    searchForCalendar: jest.fn().mockResolvedValue(paginated([])),
  } as unknown as jest.Mocked<CalendarEventService>;

  return { taskService, calendarEventService };
}

function createService(role: UserRole, mocks = createMocks()) {
  const req = createFakeRequest(role);
  const service = new CalendarAggregationService(req, mocks.taskService, mocks.calendarEventService);
  return { service, mocks, req };
}

const FROM = new Date('2026-08-01T00:00:00.000Z');
const TO = new Date('2026-08-31T23:59:59.999Z');

describe('CalendarAggregationService.getCalendarItems', () => {
  it('scope=mine (default) scopes Tasks by assigneeId=self and Events by involvingUserId=self, ignoring staffId', async () => {
    const { service, mocks } = createService(UserRole.STAFF);

    await service.getCalendarItems({ from: FROM, to: TO, scope: 'mine', staffId: 'someone-else' } as never);

    expect(mocks.taskService.searchForCalendar).toHaveBeenCalledWith(
      expect.objectContaining({ assigneeId: USER_ID, dueAfter: FROM, dueBefore: TO }),
      expect.anything(),
    );
    expect(mocks.calendarEventService.searchForCalendar).toHaveBeenCalledWith(
      expect.objectContaining({ involvingUserId: USER_ID, from: FROM, to: TO }),
      expect.anything(),
    );
  });

  it('scope=firm requested by a restricted role (STAFF) throws ForbiddenError', async () => {
    const { service } = createService(UserRole.STAFF);

    await expect(service.getCalendarItems({ from: FROM, to: TO, scope: 'firm' } as never)).rejects.toThrow(
      /tenant-wide roles/i,
    );
  });

  it.each([UserRole.TENANT_ADMIN, UserRole.MANAGER, UserRole.MASTER_ADMIN])(
    'scope=firm is allowed for unrestricted role %s and honors an optional staffId filter',
    async (role) => {
      const { service, mocks } = createService(role);

      await service.getCalendarItems({ from: FROM, to: TO, scope: 'firm', staffId: 'staff-9' } as never);

      expect(mocks.taskService.searchForCalendar).toHaveBeenCalledWith(
        expect.objectContaining({ assigneeId: 'staff-9' }),
        expect.anything(),
      );
    },
  );

  it('source=TASK only queries TaskService, never CalendarEventService', async () => {
    const { service, mocks } = createService(UserRole.TENANT_ADMIN);

    await service.getCalendarItems({ from: FROM, to: TO, scope: 'firm', source: 'TASK' } as never);

    expect(mocks.taskService.searchForCalendar).toHaveBeenCalled();
    expect(mocks.calendarEventService.searchForCalendar).not.toHaveBeenCalled();
  });

  it('source=EVENT only queries CalendarEventService, never TaskService', async () => {
    const { service, mocks } = createService(UserRole.TENANT_ADMIN);

    await service.getCalendarItems({ from: FROM, to: TO, scope: 'firm', source: 'EVENT' } as never);

    expect(mocks.calendarEventService.searchForCalendar).toHaveBeenCalled();
    expect(mocks.taskService.searchForCalendar).not.toHaveBeenCalled();
  });

  it('merges Tasks and Events and sorts the combined feed chronologically', async () => {
    const { service, mocks } = createService(UserRole.TENANT_ADMIN);

    mocks.taskService.searchForCalendar.mockResolvedValue(
      paginated([
        {
          id: 'task-1',
          title: 'GST Return',
          status: TaskStatus.IN_PROGRESS,
          priority: null,
          dueDate: new Date('2026-08-15T00:00:00.000Z'),
          business: null,
          assignee: null,
        } as never,
      ]),
    );
    mocks.calendarEventService.searchForCalendar.mockResolvedValue(
      paginated([
        {
          id: 'event-1',
          title: 'Client Meeting',
          startAt: new Date('2026-08-10T05:30:00.000Z'),
          endAt: new Date('2026-08-10T06:00:00.000Z'),
          allDay: false,
          eventType: 'CLIENT_MEETING',
          location: null,
          meetingUrl: null,
          business: null,
          attendees: [],
        } as never,
      ]),
    );

    const items = await service.getCalendarItems({ from: FROM, to: TO, scope: 'firm' } as never);

    expect(items.map((item) => item.id)).toEqual(['event-1', 'task-1']);
    expect(items[0].source).toBe('EVENT');
    expect(items[1].source).toBe('TASK');
  });
});
