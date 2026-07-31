import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { PublicBrandingService } from '../service/public-branding.service';
import { ResolvePublicBrandingQueryDto } from '../dto/branding.req.dto';

const service = new PublicBrandingService();

export class PublicBrandingController {
  static resolve = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { host } = req.query as unknown as ResolvePublicBrandingQueryDto;
    const branding = await service.resolveByHostname(host);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, branding, MESSAGES.FETCHED));
  });
}
