import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { TaskService } from '../service/task.service';
import { TaskMapper } from '../mapper/task.mapper';
import {
  CreateTaskDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
  ListTasksQueryDto,
} from '../dto/task.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Task Controller
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Thin HTTP adapter. By the time a handler runs, `validate()` (wired in
 * routes.ts) has already parsed and replaced `req.body` / `req.params` /
 * `req.query`. Each handler does nothing but: instantiate `TaskService`,
 * call exactly one service method, map the result through `TaskMapper`, and
 * respond via `ApiResponseHelper`. No business logic, no Prisma, no
 * repository access. Mirrors `modules/projects/controller/project.controller.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class TaskController {
  static create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new TaskService(req);
    const task = await service.createTask(req.body as CreateTaskDto);

    res
      .status(HTTP_STATUS.CREATED)
      .json(ApiResponseHelper.created(req, TaskMapper.toResponseDto(task)));
  });

  static update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new TaskService(req);
    const task = await service.updateTask(req.params.id, req.body as UpdateTaskDto);

    res
      .status(HTTP_STATUS.OK)
      .json(ApiResponseHelper.updated(req, TaskMapper.toResponseDto(task)));
  });

  static updateStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new TaskService(req);
    const task = await service.updateTaskStatus(req.params.id, req.body as UpdateTaskStatusDto);

    res
      .status(HTTP_STATUS.OK)
      .json(ApiResponseHelper.updated(req, TaskMapper.toResponseDto(task)));
  });

  static delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new TaskService(req);
    await service.deleteTask(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.deleted(req));
  });

  static restore = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new TaskService(req);
    const task = await service.restoreTask(req.params.id);

    res
      .status(HTTP_STATUS.OK)
      .json(ApiResponseHelper.success(req, TaskMapper.toResponseDto(task), MESSAGES.RESTORED));
  });

  static getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new TaskService(req);
    const task = await service.getTaskById(req.params.id);

    res
      .status(HTTP_STATUS.OK)
      .json(ApiResponseHelper.success(req, TaskMapper.toResponseDto(task), MESSAGES.FETCHED));
  });

  static list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new TaskService(req);
    const { data, meta } = await service.listTasks(req.query as unknown as ListTasksQueryDto);

    res
      .status(HTTP_STATUS.OK)
      .json(ApiResponseHelper.paginated(req, TaskMapper.toResponseDtoList(data), meta));
  });

  static getByProject = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new TaskService(req);
    const tasks = await service.getTasksByProject(req.params.projectId);

    res
      .status(HTTP_STATUS.OK)
      .json(
        ApiResponseHelper.success(req, TaskMapper.toResponseDtoList(tasks), MESSAGES.FETCHED),
      );
  });

  static getByAssignee = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new TaskService(req);
    const tasks = await service.getTasksByAssignee(req.params.assigneeId);

    res
      .status(HTTP_STATUS.OK)
      .json(
        ApiResponseHelper.success(req, TaskMapper.toResponseDtoList(tasks), MESSAGES.FETCHED),
      );
  });

  static getOverdue = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new TaskService(req);
    const tasks = await service.getOverdueTasks();

    res
      .status(HTTP_STATUS.OK)
      .json(
        ApiResponseHelper.success(req, TaskMapper.toResponseDtoList(tasks), MESSAGES.FETCHED),
      );
  });
}
