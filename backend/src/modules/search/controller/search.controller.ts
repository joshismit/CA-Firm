import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { SearchService } from '../service/search.service';
import { SearchQueryDto } from '../dto/search.req.dto';

/** Thin HTTP adapter. Mirrors `modules/reports/controller/report.controller.ts`. */
export class SearchController {
  static search = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new SearchService(req);
    const { q, limit } = req.query as unknown as SearchQueryDto;

    const result = await service.search(q, limit);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, result, MESSAGES.FETCHED));
  });
}
