import { PrismaClient, Prisma, CalendarEvent, CalendarEventType } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';
import { PaginationQuery, PaginationMeta } from '@shared/types';

/**
 * Domain-shaped search criteria for `CalendarEventRepository.search()`.
 * Mirrors `TaskSearchFilters` (`modules/tasks/repository/task.repository.ts`)'s
 * own shape and reasoning.
 */
export interface CalendarEventSearchFilters {
  from?: Date;
  to?: Date;
  businessId?: string;
  eventType?: CalendarEventType;
  createdById?: string;
  /** Matches events where this user is either the creator or an invited attendee — the "My Work" filter (PRD §11). */
  involvingUserId?: string;
}

/** The relation shape every read of a `CalendarEvent` needs — the calendar UI always shows the business name, creator name, and attendee names (PRD §16/§18). */
export const CALENDAR_EVENT_INCLUDE = {
  business: { select: { id: true, name: true } },
  createdByUser: { select: { id: true, firstName: true, lastName: true } },
  attendees: { select: { user: { select: { id: true, firstName: true, lastName: true } } } },
} satisfies Prisma.CalendarEventInclude;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Calendar Event Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Data access for the `CalendarEvent` entity only. Inherits tenant scoping,
 * soft delete, and standard CRUD/pagination from `BaseRepository` — mirrors
 * `TaskRepository`'s shape exactly.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class CalendarEventRepository extends BaseRepository<Prisma.CalendarEventDelegate, CalendarEvent> {
  constructor(prisma: PrismaClient) {
    super(prisma.calendarEvent, prisma);
  }

  /**
   * Paginated search combining the standard list filters. Builds the Prisma
   * `where` clause internally so callers only ever deal with
   * `CalendarEventSearchFilters`.
   */
  async search(
    filters: CalendarEventSearchFilters,
    pagination: PaginationQuery,
    options: RepositoryOptions = {},
    scopeWhere?: Prisma.CalendarEventWhereInput,
    include?: Prisma.CalendarEventInclude,
  ): Promise<{ data: CalendarEvent[]; meta: PaginationMeta }> {
    const where: Prisma.CalendarEventWhereInput = {};

    // Date-range overlap: an event overlaps [from, to] when startAt <= to AND
    // (endAt ?? startAt) >= from. Prisma can't express `COALESCE(endAt, startAt)`
    // directly, so the second half is an exact two-branch OR, not an approximation.
    const andClauses: Prisma.CalendarEventWhereInput[] = [];
    if (filters.to) andClauses.push({ startAt: { lte: filters.to } });
    if (filters.from) {
      andClauses.push({
        OR: [{ endAt: { gte: filters.from } }, { endAt: null, startAt: { gte: filters.from } }],
      });
    }
    if (andClauses.length > 0) where.AND = andClauses;

    if (filters.businessId) where.businessId = filters.businessId;
    if (filters.eventType) where.eventType = filters.eventType;
    if (filters.createdById) where.createdById = filters.createdById;
    if (filters.involvingUserId) {
      where.OR = [
        { createdById: filters.involvingUserId },
        { attendees: { some: { userId: filters.involvingUserId } } },
      ];
    }

    const combinedWhere = scopeWhere && Object.keys(scopeWhere).length > 0 ? { AND: [where, scopeWhere] } : where;

    return this.paginate(pagination, combinedWhere, options, include);
  }
}
