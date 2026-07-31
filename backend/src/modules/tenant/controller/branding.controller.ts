import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { TenantBrandingService } from '../service/tenant-branding.service';
import { UpdateTenantBrandingDto } from '../dto/branding.req.dto';
import { BrandingAssetSlot } from '../schemas/branding.schema';

/**
 * Thin HTTP adapter. Mirrors `modules/documents/controller/document.controller.ts`.
 */
export class BrandingController {
  static get = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new TenantBrandingService(req);
    const branding = await service.getBranding();

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, branding, MESSAGES.FETCHED));
  });

  static update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new TenantBrandingService(req);
    const branding = await service.updateBranding(req.body as UpdateTenantBrandingDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.updated(req, branding));
  });

  static uploadAsset = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new TenantBrandingService(req);
    const branding = await service.uploadAsset(req.body.slot as BrandingAssetSlot, req.file);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.updated(req, branding));
  });
}
