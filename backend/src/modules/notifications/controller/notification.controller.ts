import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { NotificationService } from '../service/notification.service';
import { NotificationMapper } from '../mapper/notification.mapper';
import { ListNotificationsQueryDto } from '../dto/notification.req.dto';

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
}
