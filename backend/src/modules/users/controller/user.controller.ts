import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { UserService } from '../service/user.service';
import { UserMapper } from '../mapper/user.mapper';
import { InviteUserDto, UpdateUserDto, ListUsersQueryDto } from '../dto/user.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * User Controller
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Thin HTTP adapter. By the time a handler runs, `validate()` (wired in
 * routes.ts) has already parsed and replaced `req.body` / `req.params` /
 * `req.query`. Each handler does nothing but: instantiate `UserService`, call
 * exactly one service method, map the result through `UserMapper`, and
 * respond via `ApiResponseHelper`. No business logic, no Prisma, no
 * repository access. Mirrors `modules/contacts/controller/contact.controller.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class UserController {
  static list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new UserService(req);
    const { data, meta } = await service.listUsers(req.query as unknown as ListUsersQueryDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.paginated(req, UserMapper.toResponseDtoList(data), meta));
  });

  static getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new UserService(req);
    const user = await service.getUserById(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, UserMapper.toResponseDto(user), MESSAGES.FETCHED));
  });

  static update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new UserService(req);
    const user = await service.updateUser(req.params.id, req.body as UpdateUserDto);

    res
      .status(HTTP_STATUS.OK)
      .json(ApiResponseHelper.updated(req, UserMapper.toResponseDto(user), MESSAGES.USER_UPDATED));
  });

  static delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new UserService(req);
    await service.deleteUser(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.deleted(req, undefined, MESSAGES.USER_DELETED));
  });

  static getRoles = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new UserService(req);
    const roles = await service.getUserRoles(req.params.id);

    res
      .status(HTTP_STATUS.OK)
      .json(ApiResponseHelper.success(req, UserMapper.toRoleResponseDtoList(roles), MESSAGES.FETCHED));
  });

  static getSessions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new UserService(req);
    const sessions = await service.getUserSessions(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, sessions, MESSAGES.FETCHED));
  });

  static revokeSession = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new UserService(req);
    await service.revokeUserSession(req.params.id, req.params.sessionId);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.deleted(req, undefined, 'Session revoked successfully'));
  });

  static invite = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new UserService(req);
    const invitation = await service.inviteUser(req.body as InviteUserDto);

    res
      .status(HTTP_STATUS.CREATED)
      .json(ApiResponseHelper.created(req, UserMapper.toInvitationResponseDto(invitation), MESSAGES.INVITATION_SENT));
  });

  static resendInvitation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new UserService(req);
    await service.resendInvitation(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, null, MESSAGES.INVITATION_SENT));
  });

  static revokeInvitation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new UserService(req);
    await service.revokeInvitation(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.deleted(req, undefined, MESSAGES.INVITATION_REVOKED));
  });
}
