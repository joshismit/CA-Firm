import { Request, Response } from 'express';
import { UserRole } from '@shared/enums';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { DashboardTenantDefaultService } from '../service/dashboard-tenant-default.service';
import { UpdateDashboardTenantDefaultDto } from '../dto/dashboard-tenant-default.req.dto';

/**
 * Thin HTTP adapter over `DashboardTenantDefaultService` (PRD §10.3). Every
 * route is gated `requireRole(UserRole.TENANT_ADMIN)` at the router level
 * (`dashboard-tenant-default.routes.ts`) — this controller trusts that gate.
 */
export class DashboardTenantDefaultController {
  static list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new DashboardTenantDefaultService(req);
    const defaults = await service.listDefaults();

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, defaults, MESSAGES.FETCHED));
  });

  static upsert = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { role } = req.params as unknown as { role: UserRole };
    const service = new DashboardTenantDefaultService(req);
    const result = await service.upsertDefault(role, req.body as UpdateDashboardTenantDefaultDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.updated(req, result));
  });

  static remove = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { role } = req.params as unknown as { role: UserRole };
    const service = new DashboardTenantDefaultService(req);
    await service.deleteDefault(role);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.deleted(req));
  });
}
