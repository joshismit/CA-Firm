import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { TenantDomainService } from '../service/tenant-domain.service';
import { CreateTenantDomainDto } from '../dto/domain.req.dto';

/**
 * Thin HTTP adapter. Mirrors `modules/documents/controller/document.controller.ts`.
 */
export class DomainController {
  static get = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new TenantDomainService(req);
    const domain = await service.getDomain();

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, domain, MESSAGES.FETCHED));
  });

  static create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new TenantDomainService(req);
    const domain = await service.createDomain(req.body as CreateTenantDomainDto);

    res.status(HTTP_STATUS.CREATED).json(ApiResponseHelper.created(req, domain));
  });

  static verify = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new TenantDomainService(req);
    const domain = await service.verifyDomain();

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, domain, MESSAGES.FETCHED));
  });

  static delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new TenantDomainService(req);
    await service.deleteDomain();

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.deleted(req));
  });
}
