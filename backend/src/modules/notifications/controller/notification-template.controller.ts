import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { NotificationTemplateService } from '../service/notification-template.service';
import { NotificationTemplateMapper } from '../mapper/notification-template.mapper';
import {
  CreateNotificationTemplateDto,
  UpdateNotificationTemplateDto,
  ListNotificationTemplatesQueryDto,
} from '../dto/notification-template.req.dto';

/** Thin HTTP adapter. Mirrors `modules/tasks/controller/task-template.controller.ts`. */
export class NotificationTemplateController {
  static list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new NotificationTemplateService(req);
    const { data, meta } = await service.listCatalog(req.query as unknown as ListNotificationTemplatesQueryDto);

    const dtos = data.map(({ template, isOverridden }) => NotificationTemplateMapper.toResponseDto(template, isOverridden));
    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.paginated(req, dtos, meta));
  });

  static getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new NotificationTemplateService(req);
    const { template, isOverridden } = await service.getTemplateById(req.params.id);

    res
      .status(HTTP_STATUS.OK)
      .json(ApiResponseHelper.success(req, NotificationTemplateMapper.toResponseDto(template, isOverridden), MESSAGES.FETCHED));
  });

  static create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new NotificationTemplateService(req);
    const template = await service.createTemplate(req.body as CreateNotificationTemplateDto);

    res.status(HTTP_STATUS.CREATED).json(ApiResponseHelper.created(req, NotificationTemplateMapper.toResponseDto(template, true)));
  });

  static update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new NotificationTemplateService(req);
    const template = await service.updateTemplate(req.params.id, req.body as UpdateNotificationTemplateDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.updated(req, NotificationTemplateMapper.toResponseDto(template, true)));
  });

  static delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new NotificationTemplateService(req);
    await service.deleteTemplate(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.deleted(req));
  });
}
