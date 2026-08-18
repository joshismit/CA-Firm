import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { RoleService } from '../service/role.service';
import { RoleMapper } from '../mapper/role.mapper';
import { CreateRoleDto, UpdateRoleDto, ListRolesQueryDto, AssignRoleDto } from '../dto/role.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Role Controller
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Thin HTTP adapter. By the time a handler runs, `validate()` (wired in
 * routes.ts) has already parsed and replaced `req.body` / `req.params` /
 * `req.query`. Each handler does nothing but: instantiate `RoleService`, call
 * exactly one service method, map the result through `RoleMapper`, and
 * respond via `ApiResponseHelper`. No business logic, no Prisma, no
 * repository access. Mirrors `modules/contacts/controller/contact.controller.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class RoleController {
  static list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new RoleService(req);
    const { data, meta } = await service.listRoles(req.query as unknown as ListRolesQueryDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.paginated(req, RoleMapper.toResponseDtoList(data), meta));
  });

  static getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new RoleService(req);
    const role = await service.getRoleById(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, RoleMapper.toResponseDto(role), MESSAGES.FETCHED));
  });

  static getUsers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new RoleService(req);
    const users = await service.getRoleUsers(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, users, MESSAGES.FETCHED));
  });

  static create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new RoleService(req);
    const role = await service.createRole(req.body as CreateRoleDto);

    res
      .status(HTTP_STATUS.CREATED)
      .json(ApiResponseHelper.created(req, RoleMapper.toResponseDto(role), MESSAGES.ROLE_CREATED));
  });

  static update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new RoleService(req);
    const role = await service.updateRole(req.params.id, req.body as UpdateRoleDto);

    res
      .status(HTTP_STATUS.OK)
      .json(ApiResponseHelper.updated(req, RoleMapper.toResponseDto(role), MESSAGES.ROLE_UPDATED));
  });

  static delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new RoleService(req);
    await service.deleteRole(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.deleted(req, undefined, MESSAGES.ROLE_DELETED));
  });

  static assign = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new RoleService(req);
    await service.assignRole(req.body as AssignRoleDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, null, MESSAGES.ROLE_ASSIGNED));
  });

  static revoke = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new RoleService(req);
    await service.revokeRole(req.body as AssignRoleDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, null, MESSAGES.ROLE_UNASSIGNED));
  });
}
