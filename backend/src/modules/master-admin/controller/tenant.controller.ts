import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { TenantService } from '../service/tenant.service';
import { ListTenantsQueryDto, UpdateTenantLimitsDto, UpdateTenantStatusDto } from '../dto/master-admin.req.dto';

/**
 * Thin HTTP adapter — mirrors `modules/business/controller/business.controller.ts`.
 * No `create`/`delete` handlers: see `TenantService`'s header comment for why.
 */
export class TenantController {
  static list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new TenantService(req);
    const { data, meta } = await service.listTenants(req.query as unknown as ListTenantsQueryDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.paginated(req, data, meta));
  });

  static getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new TenantService(req);
    const tenant = await service.getTenantById(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, tenant, MESSAGES.FETCHED));
  });

  static updateStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new TenantService(req);
    const tenant = await service.updateStatus(req.params.id, req.body as UpdateTenantStatusDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.updated(req, tenant));
  });

  static updateLimits = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new TenantService(req);
    const tenant = await service.updateLimits(req.params.id, req.body as UpdateTenantLimitsDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.updated(req, tenant));
  });
}
