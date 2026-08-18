import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { NotificationService } from '../service/notification.service';
import { NotificationMapper } from '../mapper/notification.mapper';
import {
  ListNotificationsQueryDto,
  ListNotificationsHistoryQueryDto,
  SendNotificationDto,
  ScheduleNotificationDto,
  TestNotificationDto,
} from '../dto/notification.req.dto';

/**
 * Thin HTTP adapter. Mirrors `modules/contacts/controller/contact.controller.ts`.
 */
export class NotificationController {
  static list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new NotificationService(req);
    const { data, meta } = await service.listNotifications(req.query as unknown as ListNotificationsQueryDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.paginated(req, NotificationMapper.toResponseDtoList(data), meta));
  });

  static getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new NotificationService(req);
    const notification = await service.getNotificationById(req.params.id);

    res
      .status(HTTP_STATUS.OK)
      .json(ApiResponseHelper.success(req, NotificationMapper.toResponseDto(notification), MESSAGES.FETCHED));
  });

  static markAsRead = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new NotificationService(req);
    await service.markAsRead(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.updated(req, null));
  });

  static markAllAsRead = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new NotificationService(req);
    await service.markAllAsRead();

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.updated(req, null));
  });

  static delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new NotificationService(req);
    await service.deleteNotification(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.deleted(req));
  });

  static dashboard = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new NotificationService(req);
    const widgets = await service.getDashboardWidgets();

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, widgets, MESSAGES.FETCHED));
  });

  static history = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new NotificationService(req);
    const { data, meta } = await service.listHistory(req.query as unknown as ListNotificationsHistoryQueryDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.paginated(req, NotificationMapper.toHistoryResponseDtoList(data), meta));
  });

  static send = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new NotificationService(req);
    const notifications = await service.sendNotification(req.body as SendNotificationDto);

    res
      .status(HTTP_STATUS.CREATED)
      .json(ApiResponseHelper.created(req, NotificationMapper.toHistoryResponseDtoList(notifications)));
  });

  static schedule = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new NotificationService(req);
    const notifications = await service.scheduleNotification(req.body as ScheduleNotificationDto);

    res
      .status(HTTP_STATUS.CREATED)
      .json(ApiResponseHelper.created(req, NotificationMapper.toHistoryResponseDtoList(notifications)));
  });

  static test = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new NotificationService(req);
    const notifications = await service.sendTestNotification(req.body as TestNotificationDto);

    res
      .status(HTTP_STATUS.CREATED)
      .json(ApiResponseHelper.created(req, NotificationMapper.toHistoryResponseDtoList(notifications)));
  });

  static cancel = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new NotificationService(req);
    await service.cancelNotification(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.updated(req, null));
  });
}
