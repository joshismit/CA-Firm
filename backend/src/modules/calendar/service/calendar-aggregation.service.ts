import { Request } from 'express';
import { BaseService } from '@shared/base';
import { ForbiddenError } from '@shared/errors';
import { UserRole } from '@shared/enums';
import { TaskService, TaskSearchFilters } from '@modules/tasks';
import { CalendarEventSearchFilters } from '../repository/calendar-event.repository';
import { CalendarEventService } from './calendar-event.service';
import { CalendarMapper } from '../mapper/calendar.mapper';
import { CalendarQueryDto } from '../dto/calendar.req.dto';
import { CalendarItemDto } from '../dto/calendar.res.dto';

/** Same three-value list `CalendarEventService`/`DashboardAggregationService` each already define locally — see either's header comment for why this is the third intentional duplication rather than a shared module. */
const UNRESTRICTED_COARSE_ROLES: UserRole[] = [UserRole.TENANT_ADMIN, UserRole.MASTER_ADMIN, UserRole.MANAGER];

/** Internal cap per source — the calendar always queries a bounded date range (a visible month/week/day grid), never the whole tenant, so this is a safety ceiling, not a real pagination limit users will hit in practice. */
const CALENDAR_ITEM_LIMIT = 200;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Calendar Aggregation Service (Work Calendar)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Composes `TaskService`/`CalendarEventService` — never a raw repository —
 * mirroring `DashboardAggregationService`'s own composition-only shape.
 * Tasks remain the sole source of truth for work items: this only reads
 * through `TaskService.searchForCalendar()`, never re-derives or duplicates
 * task state.
 *
 * "My Work" vs "Firm Work" (PRD §11) is enforced by identity, not by
 * business-assignment: `scope=mine` restricts Tasks to `assigneeId = self`
 * and CalendarEvents to `createdById = self OR self is an attendee` — both
 * are always safe for the caller to see regardless of role, since they're
 * scoped to the caller's own identity. `scope=firm` additionally requires an
 * unrestricted role (`ForbiddenError` otherwise) — the literal enforcement
 * of "only users who already have tenant-wide visibility should see firm-wide
 * work."
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class CalendarAggregationService extends BaseService {
  constructor(
    req: Request,
    private readonly taskService: TaskService = new TaskService(req),
    private readonly calendarEventService: CalendarEventService = new CalendarEventService(req),
  ) {
    super(req);
  }

  async getCalendarItems(query: CalendarQueryDto): Promise<CalendarItemDto[]> {
    if (query.scope === 'firm' && !this.isUnrestricted()) {
      throw new ForbiddenError('Only tenant-wide roles may view Firm Work.');
    }

    const now = new Date();
    const wantsTasks = !query.source || query.source === 'TASK';
    const wantsEvents = !query.source || query.source === 'EVENT';
    const identityFilter = query.scope === 'mine' ? this.userId : query.staffId;
    const pagination = { page: 1, limit: CALENDAR_ITEM_LIMIT };

    const taskFilters: TaskSearchFilters = {
      businessId: query.businessId,
      status: query.status,
      dueAfter: query.from,
      dueBefore: query.to,
      assigneeId: identityFilter,
    };

    const eventFilters: CalendarEventSearchFilters = {
      businessId: query.businessId,
      eventType: query.eventType,
      from: query.from,
      to: query.to,
      involvingUserId: identityFilter,
    };

    const [tasks, events] = await Promise.all([
      wantsTasks ? this.taskService.searchForCalendar(taskFilters, pagination) : Promise.resolve({ data: [] }),
      wantsEvents ? this.calendarEventService.searchForCalendar(eventFilters, pagination) : Promise.resolve({ data: [] }),
    ]);

    const items: CalendarItemDto[] = [
      ...tasks.data.map((task) => CalendarMapper.taskToCalendarItem(task, now)),
      ...events.data.map((event) => CalendarMapper.eventToCalendarItem(event, now)),
    ];

    return items.sort((a, b) => this.sortKey(a) - this.sortKey(b));
  }

  private sortKey(item: CalendarItemDto): number {
    const value = item.startAt ?? item.endAt;
    return value ? new Date(value).getTime() : 0;
  }

  private isUnrestricted(): boolean {
    const role = this.req.user?.role;
    return !role || UNRESTRICTED_COARSE_ROLES.includes(role);
  }
}
