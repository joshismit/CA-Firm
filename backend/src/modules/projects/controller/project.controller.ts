import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { ProjectService } from '../service/project.service';
import { ProjectMapper } from '../mapper/project.mapper';
import {
  CreateProjectDto,
  UpdateProjectDto,
  UpdateProjectStatusDto,
  ListProjectsQueryDto,
} from '../dto/project.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Project Controller
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Thin HTTP adapter. By the time a handler runs, `validate()` (wired in
 * routes.ts) has already parsed and replaced `req.body` / `req.params` /
 * `req.query`. Each handler does nothing but: instantiate `ProjectService`,
 * call exactly one service method, map the result through `ProjectMapper`,
 * and respond via `ApiResponseHelper`. No business logic, no Prisma, no
 * repository access.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class ProjectController {
  static create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new ProjectService(req);
    const project = await service.createProject(req.body as CreateProjectDto);

    res
      .status(HTTP_STATUS.CREATED)
      .json(ApiResponseHelper.created(req, ProjectMapper.toResponseDto(project)));
  });

  static update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new ProjectService(req);
    const project = await service.updateProject(req.params.id, req.body as UpdateProjectDto);

    res
      .status(HTTP_STATUS.OK)
      .json(ApiResponseHelper.updated(req, ProjectMapper.toResponseDto(project)));
  });

  static updateStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new ProjectService(req);
    const project = await service.updateProjectStatus(
      req.params.id,
      req.body as UpdateProjectStatusDto,
    );

    res
      .status(HTTP_STATUS.OK)
      .json(ApiResponseHelper.updated(req, ProjectMapper.toResponseDto(project)));
  });

  static archive = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new ProjectService(req);
    const project = await service.archiveProject(req.params.id);

    res
      .status(HTTP_STATUS.OK)
      .json(
        ApiResponseHelper.success(req, ProjectMapper.toResponseDto(project), MESSAGES.ARCHIVED),
      );
  });

  static restore = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new ProjectService(req);
    const project = await service.restoreProject(req.params.id);

    res
      .status(HTTP_STATUS.OK)
      .json(
        ApiResponseHelper.success(req, ProjectMapper.toResponseDto(project), MESSAGES.RESTORED),
      );
  });

  static delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new ProjectService(req);
    await service.deleteProject(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.deleted(req));
  });

  static getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new ProjectService(req);
    const project = await service.getProjectById(req.params.id);

    res
      .status(HTTP_STATUS.OK)
      .json(ApiResponseHelper.success(req, ProjectMapper.toResponseDto(project), MESSAGES.FETCHED));
  });

  static getByCode = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new ProjectService(req);
    const project = await service.getProjectByCode(req.params.code);

    res
      .status(HTTP_STATUS.OK)
      .json(ApiResponseHelper.success(req, ProjectMapper.toResponseDto(project), MESSAGES.FETCHED));
  });

  static list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new ProjectService(req);
    const { data, meta } = await service.listProjects(req.query as unknown as ListProjectsQueryDto);

    res
      .status(HTTP_STATUS.OK)
      .json(ApiResponseHelper.paginated(req, ProjectMapper.toResponseDtoList(data), meta));
  });

  static getByClient = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new ProjectService(req);
    const projects = await service.getProjectsByClient(req.params.clientId);

    res
      .status(HTTP_STATUS.OK)
      .json(
        ApiResponseHelper.success(
          req,
          ProjectMapper.toResponseDtoList(projects),
          MESSAGES.FETCHED,
        ),
      );
  });

  static getByManager = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new ProjectService(req);
    const projects = await service.getProjectsByManager(req.params.managerId);

    res
      .status(HTTP_STATUS.OK)
      .json(
        ApiResponseHelper.success(
          req,
          ProjectMapper.toResponseDtoList(projects),
          MESSAGES.FETCHED,
        ),
      );
  });

  static getOverdue = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new ProjectService(req);
    const projects = await service.getOverdueProjects();

    res
      .status(HTTP_STATUS.OK)
      .json(
        ApiResponseHelper.success(
          req,
          ProjectMapper.toResponseDtoList(projects),
          MESSAGES.FETCHED,
        ),
      );
  });
}
