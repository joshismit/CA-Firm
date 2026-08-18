import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { ReportService } from '../service/report.service';
import { ReportTypeParamDto, ReportFiltersQueryDto, ReportExportQueryDto } from '../dto/report.req.dto';

/**
 * Thin HTTP adapter. Mirrors `modules/contacts/controller/contact.controller.ts`,
 * except `export` sends a raw file body instead of the standard JSON
 * envelope — matches the frontend's own `exportReport(): Promise<Blob>`
 * contract exactly.
 */
export class ReportController {
  static generate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new ReportService(req);
    const { type } = req.params as unknown as ReportTypeParamDto;
    const filters = req.query as unknown as ReportFiltersQueryDto;

    const result = await service.generateReport(type, filters);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, result, MESSAGES.FETCHED));
  });

  static export = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new ReportService(req);
    const { type } = req.params as unknown as ReportTypeParamDto;
    const { format, ...filters } = req.query as unknown as ReportExportQueryDto;

    const { contentType, filename, body } = await service.exportReport(type, filters, format);

    res
      .status(HTTP_STATUS.OK)
      .set('Content-Type', contentType)
      .set('Content-Disposition', `attachment; filename="${filename}"`)
      .send(body);
  });
}
