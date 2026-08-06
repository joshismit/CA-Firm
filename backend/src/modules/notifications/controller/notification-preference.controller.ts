import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { NotificationPreferenceService } from '../service/notification-preference.service';
import { UpdateNotificationPreferenceDto, UpdateFirmNotificationSettingsDto } from '../dto/notification-preference.req.dto';

/** Thin HTTP adapter. Mirrors `modules/dashboard/controller/dashboard-preference.controller.ts`. */
export class NotificationPreferenceController {
  static get = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new NotificationPreferenceService(req);
    const preferences = await service.getPreferences();

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, preferences, MESSAGES.FETCHED));
  });

  static update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new NotificationPreferenceService(req);
    const preferences = await service.updatePreferences(req.body as UpdateNotificationPreferenceDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.updated(req, preferences));
  });

  static getFirmSettings = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new NotificationPreferenceService(req);
    const settings = await service.getFirmSettings();

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, settings, MESSAGES.FETCHED));
  });

  static updateFirmSettings = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new NotificationPreferenceService(req);
    const settings = await service.updateFirmSettings(req.body as UpdateFirmNotificationSettingsDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.updated(req, settings));
  });
}
