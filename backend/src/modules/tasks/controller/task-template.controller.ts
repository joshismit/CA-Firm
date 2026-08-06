import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { TaskTemplateService } from '../service/task-template.service';
import { TaskTemplateMapper } from '../mapper/task-template.mapper';
import { TaskMapper } from '../mapper/task.mapper';
import {
  CreateTaskTemplateDto,
  UpdateTaskTemplateDto,
  InstantiateTaskTemplateDto,
  ListTaskTemplatesQueryDto,
} from '../dto/task-template.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Task Template Controller
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Thin HTTP adapter. Mirrors `modules/tasks/controller/task.controller.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class TaskTemplateController {
  static create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new TaskTemplateService(req);
    const template = await service.createTemplate(req.body as CreateTaskTemplateDto);

    res
      .status(HTTP_STATUS.CREATED)
      .json(ApiResponseHelper.created(req, TaskTemplateMapper.toResponseDto(template)));
  });

  static update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new TaskTemplateService(req);
    const template = await service.updateTemplate(req.params.id, req.body as UpdateTaskTemplateDto);

    res
      .status(HTTP_STATUS.OK)
      .json(ApiResponseHelper.updated(req, TaskTemplateMapper.toResponseDto(template)));
  });

  static delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new TaskTemplateService(req);
    await service.deleteTemplate(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.deleted(req));
  });

  static getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new TaskTemplateService(req);
    const template = await service.getTemplateById(req.params.id);

    res
      .status(HTTP_STATUS.OK)
      .json(ApiResponseHelper.success(req, TaskTemplateMapper.toResponseDto(template), MESSAGES.FETCHED));
  });

  static list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new TaskTemplateService(req);
    const { data, meta } = await service.listTemplates(req.query as unknown as ListTaskTemplatesQueryDto);

    res
      .status(HTTP_STATUS.OK)
      .json(ApiResponseHelper.paginated(req, TaskTemplateMapper.toResponseDtoList(data), meta));
  });

  static instantiate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new TaskTemplateService(req);
    const task = await service.instantiate(req.params.id, req.body as InstantiateTaskTemplateDto);

    res
      .status(HTTP_STATUS.CREATED)
      .json(ApiResponseHelper.created(req, TaskMapper.toResponseDto(task)));
  });
}
