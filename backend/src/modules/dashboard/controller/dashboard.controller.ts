import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { DashboardAggregationService } from '../service/dashboard-aggregation.service';
import { DashboardWidgetDataId } from '../constants/dashboard-widget-ids';

/**
 * Thin HTTP adapter over `DashboardAggregationService` (PRD §10.10). Mirrors
 * `modules/dashboard/controller/dashboard-preference.controller.ts`. All query
 * params arrive already validated/coerced by `validate()` (`dashboard.schema.ts`)
 * before these handlers run.
 */
export class DashboardController {
  static getOverview = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new DashboardAggregationService(req);
    const overview = await service.getOverview();

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, overview, MESSAGES.FETCHED));
  });

  static getWidgetData = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { ids, limit } = req.query as unknown as { ids: DashboardWidgetDataId[]; limit: number };
    const service = new DashboardAggregationService(req);
    const data = await service.getWidgetData(ids, limit);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, data, MESSAGES.FETCHED));
  });

  static getCalendar = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { from, to } = req.query as unknown as { from?: Date; to?: Date };
    const now = new Date();
    const defaultTo = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const service = new DashboardAggregationService(req);
    const calendar = await service.getCalendar(from ?? now, to ?? defaultTo);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, calendar, MESSAGES.FETCHED));
  });

  static getActivity = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { limit } = req.query as unknown as { limit: number };
    const service = new DashboardAggregationService(req);
    const activity = await service.getActivity(limit);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, activity, MESSAGES.FETCHED));
  });

  static getPerformance = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { from, to } = req.query as unknown as { from?: Date; to?: Date };
    const service = new DashboardAggregationService(req);
    const performance = await service.getPerformance(from, to);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, performance, MESSAGES.FETCHED));
  });
}
