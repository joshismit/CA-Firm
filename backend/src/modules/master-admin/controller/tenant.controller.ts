import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { TenantService } from '../service/tenant.service';
import { CreateTenantDto, ListTenantsQueryDto, UpdateTenantLimitsDto, UpdateTenantStatusDto } from '../dto/master-admin.req.dto';

/**
 * Thin HTTP adapter — mirrors `modules/business/controller/business.controller.ts`.
 * No `delete` handler: tenants are deactivated (`updateStatus`), never hard-deleted.
 */
export class TenantController {
  static create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new TenantService(req);
    const tenant = await service.createTenant(req.body as CreateTenantDto);

    res.status(HTTP_STATUS.CREATED).json(ApiResponseHelper.success(req, tenant, MESSAGES.CREATED));
  });

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

  /** Backs the master-admin audit filter's "User" selector — see `TenantService.listTenantUsers()`. */
  static listUsers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new TenantService(req);
    const users = await service.listTenantUsers(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, users, MESSAGES.FETCHED));
  });
}
