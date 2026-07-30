import { Request, Response } from 'express';
import { ComplianceCategory } from '@prisma/client';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { ComplianceFilingService } from '../service/compliance-filing.service';
import { ComplianceFilingMapper } from '../mapper/compliance-filing.mapper';
import { CreateComplianceFilingDto, UpdateComplianceFilingDto, ListComplianceFilingsQueryDto } from '../dto/compliance-filing.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Compliance Filing Controller
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * A factory, not a static class — this module is mounted 4 times (`/gst`,
 * `/itr`, `/tds`, `/mca`, see `routes/compliance-filing.routes.ts`), each
 * needing handlers bound to a fixed `category`. Otherwise mirrors
 * `modules/contacts/controller/contact.controller.ts` exactly: each handler
 * does nothing but instantiate `ComplianceFilingService`, call exactly one
 * service method, map the result through `ComplianceFilingMapper`, and
 * respond via `ApiResponseHelper`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function createComplianceFilingController(category: ComplianceCategory) {
  return {
    list: asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const service = new ComplianceFilingService(req, category);
      const { data, meta } = await service.listFilings(req.query as unknown as ListComplianceFilingsQueryDto);

      res
        .status(HTTP_STATUS.OK)
        .json(ApiResponseHelper.paginated(req, ComplianceFilingMapper.toResponseDtoList(data), meta));
    }),

    getById: asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const service = new ComplianceFilingService(req, category);
      const filing = await service.getFilingById(req.params.id);

      res
        .status(HTTP_STATUS.OK)
        .json(ApiResponseHelper.success(req, ComplianceFilingMapper.toResponseDto(filing), MESSAGES.FETCHED));
    }),

    create: asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const service = new ComplianceFilingService(req, category);
      const filing = await service.createFiling(req.body as CreateComplianceFilingDto);

      res
        .status(HTTP_STATUS.CREATED)
        .json(ApiResponseHelper.created(req, ComplianceFilingMapper.toResponseDto(filing)));
    }),

    update: asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const service = new ComplianceFilingService(req, category);
      const filing = await service.updateFiling(req.params.id, req.body as UpdateComplianceFilingDto);

      res
        .status(HTTP_STATUS.OK)
        .json(ApiResponseHelper.updated(req, ComplianceFilingMapper.toResponseDto(filing)));
    }),

    delete: asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const service = new ComplianceFilingService(req, category);
      await service.deleteFiling(req.params.id);

      res.status(HTTP_STATUS.OK).json(ApiResponseHelper.deleted(req));
    }),
  };
}
