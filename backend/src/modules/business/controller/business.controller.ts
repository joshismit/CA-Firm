import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { BusinessService } from '../service/business.service';
import { BusinessMapper } from '../mapper/business.mapper';
import { CreateBusinessDto, UpdateBusinessDto, ListBusinessesQueryDto } from '../dto/business.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Business Controller
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Thin HTTP adapter. By the time a handler runs, `validate()` (wired in
 * routes.ts) has already parsed and replaced `req.body` / `req.params` /
 * `req.query`. Each handler does nothing but: instantiate `BusinessService`,
 * call exactly one service method, map the result through `BusinessMapper`,
 * and respond via `ApiResponseHelper`. No business logic, no Prisma, no
 * repository access. Mirrors `modules/projects/controller/project.controller.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class BusinessController {
  static create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new BusinessService(req);
    const business = await service.createBusiness(req.body as CreateBusinessDto);

    res
      .status(HTTP_STATUS.CREATED)
      .json(ApiResponseHelper.created(req, BusinessMapper.toResponseDto(business)));
  });

  static update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new BusinessService(req);
    const business = await service.updateBusiness(req.params.id, req.body as UpdateBusinessDto);

    res
      .status(HTTP_STATUS.OK)
      .json(ApiResponseHelper.updated(req, BusinessMapper.toResponseDto(business)));
  });

  static delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new BusinessService(req);
    await service.deleteBusiness(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.deleted(req));
  });

  static getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new BusinessService(req);
    const [business, storageUsage] = await Promise.all([
      service.getBusinessById(req.params.id),
      service.getBusinessStorageUsage(req.params.id),
    ]);

    res
      .status(HTTP_STATUS.OK)
      .json(ApiResponseHelper.success(req, BusinessMapper.toResponseDto(business, storageUsage), MESSAGES.FETCHED));
  });

  static list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new BusinessService(req);
    const { data, meta } = await service.listBusinesses(req.query as unknown as ListBusinessesQueryDto);

    res
      .status(HTTP_STATUS.OK)
      .json(ApiResponseHelper.paginated(req, BusinessMapper.toResponseDtoList(data), meta));
  });

  static listTypes = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new BusinessService(req);
    const types = await service.listBusinessTypes();

    res
      .status(HTTP_STATUS.OK)
      .json(
        ApiResponseHelper.success(req, BusinessMapper.toTypeResponseDtoList(types), MESSAGES.FETCHED),
      );
  });
}
