import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { PermissionService } from '../service/permission.service';
import { PermissionMapper } from '../mapper/permission.mapper';
import { UpdatePermissionMatrixDto } from '../dto/permission.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Permission Controller
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Thin HTTP adapter. By the time a handler runs, `validate()` (wired in
 * routes.ts) has already parsed and replaced `req.params` / `req.body`. Each
 * handler does nothing but: instantiate `PermissionService`, call exactly
 * one service method, map the result through `PermissionMapper`, and
 * respond via `ApiResponseHelper`. No business logic, no Prisma, no
 * repository access. Mirrors `modules/contacts/controller/contact.controller.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class PermissionController {
  static list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new PermissionService(req);
    const permissions = await service.listPermissions();

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, PermissionMapper.toResponseDtoList(permissions), MESSAGES.FETCHED));
  });

  static listGroups = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new PermissionService(req);
    const groups = await service.listPermissionGroups();

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, PermissionMapper.toGroupResponseDtoList(groups), MESSAGES.FETCHED));
  });

  static getMatrix = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new PermissionService(req);
    const entries = await service.getPermissionMatrix(req.params.roleId);

    const dtoList = entries.map((entry) => PermissionMapper.toMatrixEntryResponseDto(req.params.roleId, entry.permissionId, entry.granted));
    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, dtoList, MESSAGES.FETCHED));
  });

  static updateMatrix = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new PermissionService(req);
    await service.updatePermissionMatrix(req.body as UpdatePermissionMatrixDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.updated(req, null));
  });
}
