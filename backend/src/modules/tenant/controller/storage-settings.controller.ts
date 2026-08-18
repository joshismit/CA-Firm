import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { TenantStorageSettingsService } from '../service/tenant-storage-settings.service';
import { UpdateStorageSettingsDto } from '../dto/storage-settings.req.dto';

/**
 * Thin HTTP adapter. Mirrors `modules/tenant/controller/branding.controller.ts`.
 */
export class StorageSettingsController {
  static get = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new TenantStorageSettingsService(req);
    const settings = await service.getStorageSettings();

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, settings, MESSAGES.FETCHED));
  });

  static update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new TenantStorageSettingsService(req);
    const settings = await service.updateStorageSettings(req.body as UpdateStorageSettingsDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.updated(req, settings));
  });
}
