import { Request } from 'express';
import { CalendarEvent, CalendarEventType, AuditEventType } from '@prisma/client';
import { prisma } from '@config/database';
import { BaseService } from '@shared/base';
import { ForbiddenError, ValidationError } from '@shared/errors';
import { PaginationMeta, PaginationQuery } from '@shared/types';
import { UserRole } from '@shared/enums';
import { AuditLogRecorder } from '@modules/audit';
import { BusinessService } from '@modules/business';
import { BusinessAssignmentRepository } from '@modules/business/repository/business-assignment.repository';
import { UserRepository } from '@modules/users/repository/user.repository';
import { CalendarEventRepository, CalendarEventSearchFilters, CALENDAR_EVENT_INCLUDE } from '../repository/calendar-event.repository';
import { CreateCalendarEventDto, UpdateCalendarEventDto } from '../dto/calendar.req.dto';

/** Same three-value "tenant-wide visibility" role list `DashboardAggregationService`/
 *  `DocumentAccessScopeService` each already define locally — the codebase's own
 *  precedent (see `dashboard-aggregation.service.ts`'s comment) is a third small
 *  duplication here rather than a shared constants module for one array. */
const UNRESTRICTED_COARSE_ROLES: UserRole[] = [UserRole.TENANT_ADMIN, UserRole.MASTER_ADMIN, UserRole.MANAGER];

/** `CalendarEvent` with its `business`/`createdByUser`/`attendees.user` relations eager-loaded — the shape every method on this service returns (always requests `CALENDAR_EVENT_INCLUDE`). */
export interface CalendarEventWithRelations extends CalendarEvent {
  business: { id: string; name: string } | null;
  createdByUser: { id: string; firstName: string; lastName: string };
  attendees: { user: { id: string; firstName: string; lastName: string } }[];
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Calendar Event Service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Work Calendar — CRUD for the minimal `CalendarEvent` meeting/appointment
 * entity (PRD §5). Never touches `Task` — Tasks remain the sole source of
 * truth for work items; this only models things a Task has no equivalent for
 * (a meeting has a time-of-day, `Task.dueDate` is date-only).
 *
 * Visibility (`getEventById`) is broader than mutation (`updateEvent`/
 * `deleteEvent`): a business-assigned staff member can *see* a client meeting
 * tied to their business even if they're neither the creator nor an invited
 * attendee, but only the creator (or an unrestricted role) may edit/delete
 * it — mirrors `TaskAccessScopeService`'s own "read is broader than write"
 * shape, adapted to ownership instead of assignee/creator identity since
 * `CalendarEvent` has no analogous "assignee".
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class CalendarEventService extends BaseService {
  constructor(
    req: Request,
    private readonly repository: CalendarEventRepository = new CalendarEventRepository(prisma),
    private readonly businessService: BusinessService = new BusinessService(req),
    private readonly businessAssignmentRepository: BusinessAssignmentRepository = new BusinessAssignmentRepository(prisma),
    private readonly userRepository: UserRepository = new UserRepository(prisma),
    private readonly auditLogRecorder: AuditLogRecorder = new AuditLogRecorder(),
  ) {
    super(req);
  }

  async createEvent(dto: CreateCalendarEventDto): Promise<CalendarEventWithRelations> {
    this.assertValidTimeRange(dto.startAt, dto.endAt ?? null);
    if (dto.businessId) await this.businessService.getBusinessById(dto.businessId);
    const attendeeIds = await this.resolveAttendeeIds(dto.attendeeIds);

    const created = await this.transaction(async (tx) => {
      const event = await this.repository.create(
        {
          title: dto.title,
          description: dto.description ?? null,
          startAt: dto.startAt,
          endAt: dto.endAt ?? null,
          allDay: dto.allDay ?? false,
          eventType: dto.eventType ?? CalendarEventType.OTHER,
          location: dto.location ?? null,
          meetingUrl: dto.meetingUrl ?? null,
          businessId: dto.businessId ?? null,
          createdById: this.userId,
        },
        { tenantId: this.tenantId, tx },
      );

      if (attendeeIds.length > 0) {
        await tx.calendarEventAttendee.createMany({
          data: attendeeIds.map((userId) => ({ tenantId: this.tenantId as string, eventId: event.id, userId })),
        });
      }

      return event;
    });

    await this.auditLogRecorder.record({
      tenantId: this.tenantId as string,
      actorId: this.userId as string,
      eventType: AuditEventType.CALENDAR_EVENT_CREATED,
      description: `Created calendar event "${created.title}"`,
      targetType: 'CalendarEvent',
      targetId: created.id,
      ipAddress: this.req.ip ?? null,
      metadata: { businessId: dto.businessId ?? null, eventType: created.eventType, attendeeCount: attendeeIds.length },
    });

    return this.getEventById(created.id);
  }

  async getEventById(id: string): Promise<CalendarEventWithRelations> {
    const event = await this.repository.findById(id, { tenantId: this.tenantId }, CALENDAR_EVENT_INCLUDE);
    this.validateExists(event, 'Calendar event');
    const eventWithRelations = event as unknown as CalendarEventWithRelations;
    await this.assertVisible(eventWithRelations);
    return eventWithRelations;
  }

  async updateEvent(id: string, dto: UpdateCalendarEventDto): Promise<CalendarEventWithRelations> {
    const existing = await this.repository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'Calendar event');
    this.assertMutable(existing);

    const nextStart = dto.startAt ?? existing.startAt;
    const nextEnd = dto.endAt === undefined ? existing.endAt : dto.endAt;
    this.assertValidTimeRange(nextStart, nextEnd);
    if (dto.businessId) await this.businessService.getBusinessById(dto.businessId);

    const nextAttendeeIds = dto.attendeeIds !== undefined ? await this.resolveAttendeeIds(dto.attendeeIds) : undefined;

    await this.transaction(async (tx) => {
      await this.repository.update(
        id,
        {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.startAt !== undefined && { startAt: dto.startAt }),
          ...(dto.endAt !== undefined && { endAt: dto.endAt }),
          ...(dto.allDay !== undefined && { allDay: dto.allDay }),
          ...(dto.eventType !== undefined && { eventType: dto.eventType }),
          ...(dto.location !== undefined && { location: dto.location }),
          ...(dto.meetingUrl !== undefined && { meetingUrl: dto.meetingUrl }),
          ...(dto.businessId !== undefined && { businessId: dto.businessId }),
        },
        { tenantId: this.tenantId, tx },
      );

      if (nextAttendeeIds !== undefined) {
        await tx.calendarEventAttendee.deleteMany({ where: { eventId: id } });
        if (nextAttendeeIds.length > 0) {
          await tx.calendarEventAttendee.createMany({
            data: nextAttendeeIds.map((userId) => ({ tenantId: this.tenantId as string, eventId: id, userId })),
          });
        }
      }
    });

    await this.auditLogRecorder.record({
      tenantId: this.tenantId as string,
      actorId: this.userId as string,
      eventType: AuditEventType.CALENDAR_EVENT_UPDATED,
      description: `Updated calendar event "${dto.title ?? existing.title}"`,
      targetType: 'CalendarEvent',
      targetId: id,
      ipAddress: this.req.ip ?? null,
    });

    return this.getEventById(id);
  }

  async deleteEvent(id: string): Promise<void> {
    const existing = await this.repository.findById(id, { tenantId: this.tenantId });
    this.validateExists(existing, 'Calendar event');
    this.assertMutable(existing);

    await this.repository.delete(id, { tenantId: this.tenantId, userId: this.userId });

    await this.auditLogRecorder.record({
      tenantId: this.tenantId as string,
      actorId: this.userId as string,
      eventType: AuditEventType.CALENDAR_EVENT_DELETED,
      description: `Deleted calendar event "${existing.title}"`,
      targetType: 'CalendarEvent',
      targetId: id,
      ipAddress: this.req.ip ?? null,
    });
  }

  /**
   * Work Calendar aggregation — thin, tenant-scoped passthrough to
   * `CalendarEventRepository.search()`, always with `CALENDAR_EVENT_INCLUDE`.
   * `CalendarAggregationService` composes via this Service, never the
   * repository directly — same rule every dashboard/calendar composition
   * layer in this codebase already follows.
   */
  async searchForCalendar(
    filters: CalendarEventSearchFilters,
    pagination: PaginationQuery,
  ): Promise<{ data: CalendarEventWithRelations[]; meta: PaginationMeta }> {
    const { data, meta } = await this.repository.search(
      filters,
      pagination,
      { tenantId: this.tenantId },
      undefined,
      CALENDAR_EVENT_INCLUDE,
    );
    return { data: data as unknown as CalendarEventWithRelations[], meta };
  }

  // ── Access control ──────────────────────────────────────────────────────

  private isUnrestricted(): boolean {
    const role = this.req.user?.role;
    return !role || UNRESTRICTED_COARSE_ROLES.includes(role);
  }

  private async assertVisible(event: CalendarEventWithRelations): Promise<void> {
    if (this.isUnrestricted()) return;
    if (event.createdById === this.userId) return;
    if (event.attendees.some((attendee) => attendee.user.id === this.userId)) return;

    if (event.businessId) {
      const assignedBusinessIds = await this.businessAssignmentRepository.findBusinessIdsForUser(
        this.userId as string,
        this.tenantId as string,
      );
      if (assignedBusinessIds.includes(event.businessId)) return;
    }

    throw new ForbiddenError('You do not have access to this calendar event.');
  }

  private assertMutable(event: CalendarEvent): void {
    if (this.isUnrestricted()) return;
    if (event.createdById === this.userId) return;
    throw new ForbiddenError('Only the event creator or an unrestricted role may modify this calendar event.');
  }

  // ── Validation helpers ───────────────────────────────────────────────────

  private assertValidTimeRange(startAt: Date, endAt: Date | null): void {
    if (endAt && endAt.getTime() < startAt.getTime()) {
      throw new ValidationError('endAt must not be before startAt.');
    }
  }

  /** De-dupes and validates every attendee id belongs to the caller's own tenant — the same "resolve users for a request payload" need `TaskService` already covers via a direct `UserRepository` import. */
  private async resolveAttendeeIds(attendeeIds: string[] | undefined): Promise<string[]> {
    if (!attendeeIds || attendeeIds.length === 0) return [];
    const uniqueIds = [...new Set(attendeeIds)];
    const users = await this.userRepository.findMany({ id: { in: uniqueIds } }, { tenantId: this.tenantId });
    if (users.length !== uniqueIds.length) {
      throw new ValidationError('One or more attendeeIds are invalid.');
    }
    return uniqueIds;
  }
}
