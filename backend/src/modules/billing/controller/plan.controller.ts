import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { PlanService } from '../service/plan.service';
import { CreatePlanDto, UpdatePlanDto } from '../dto/billing.req.dto';

/**
 * Thin HTTP adapter for the `Plan` catalog. `listPublic` backs the
 * tenant-facing `/billing/plans` route; `listForAdmin`/`create`/`update` back
 * `/master-admin/plans*` (imported directly into
 * `routes/master-admin.routes.tsx`'s backend counterpart — see this module's
 * `index.ts` header comment).
 */
export class PlanController {
  static listPublic = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new PlanService(req);
    const plans = await service.listActive();

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, plans, MESSAGES.FETCHED));
  });

  static listForAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new PlanService(req);
    const plans = await service.listAllWithTenantCount();

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, plans, MESSAGES.FETCHED));
  });

  static create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new PlanService(req);
    const plan = await service.createPlan(req.body as CreatePlanDto);

    res.status(HTTP_STATUS.CREATED).json(ApiResponseHelper.created(req, plan));
  });

  static update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new PlanService(req);
    const plan = await service.updatePlan(req.params.id, req.body as UpdatePlanDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.updated(req, plan));
  });
}
