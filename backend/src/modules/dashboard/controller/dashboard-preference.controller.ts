import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { DashboardPreferenceService } from '../service/dashboard-preference.service';
import { UpdateDashboardPreferencesDto } from '../dto/dashboard-preference.req.dto';

/**
 * Thin HTTP adapter. Mirrors `modules/tenant/controller/branding.controller.ts`.
 */
export class DashboardPreferenceController {
  static get = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new DashboardPreferenceService(req);
    const preferences = await service.getPreferences();

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, preferences, MESSAGES.FETCHED));
  });

  static update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new DashboardPreferenceService(req);
    const preferences = await service.updatePreferences(req.body as UpdateDashboardPreferencesDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.updated(req, preferences));
  });
}
