import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { CalendarAggregationService } from '../service/calendar-aggregation.service';
import { CalendarEventService } from '../service/calendar-event.service';
import { CalendarMapper } from '../mapper/calendar.mapper';
import { CalendarQueryDto, CreateCalendarEventDto, UpdateCalendarEventDto } from '../dto/calendar.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Calendar Controller
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Thin HTTP adapter — mirrors `modules/tasks/controller/task.controller.ts`.
 * No business logic, no Prisma, no repository access.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class CalendarController {
  static list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new CalendarAggregationService(req);
    const items = await service.getCalendarItems(req.query as unknown as CalendarQueryDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, { items }, MESSAGES.FETCHED));
  });

  static createEvent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new CalendarEventService(req);
    const event = await service.createEvent(req.body as CreateCalendarEventDto);

    res
      .status(HTTP_STATUS.CREATED)
      .json(ApiResponseHelper.created(req, CalendarMapper.eventToResponseDto(event)));
  });

  static getEvent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new CalendarEventService(req);
    const event = await service.getEventById(req.params.id);

    res
      .status(HTTP_STATUS.OK)
      .json(ApiResponseHelper.success(req, CalendarMapper.eventToResponseDto(event), MESSAGES.FETCHED));
  });

  static updateEvent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new CalendarEventService(req);
    const event = await service.updateEvent(req.params.id, req.body as UpdateCalendarEventDto);

    res
      .status(HTTP_STATUS.OK)
      .json(ApiResponseHelper.updated(req, CalendarMapper.eventToResponseDto(event)));
  });

  static deleteEvent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new CalendarEventService(req);
    await service.deleteEvent(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.deleted(req));
  });
}
