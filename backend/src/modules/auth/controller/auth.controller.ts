import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { AuthService } from '../service/auth.service';
import { LoginDto, RefreshTokenDto, LogoutDto, RevokeAllSessionsDto, ChangePasswordDto, RequestMeta } from '../dto/auth.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Auth Controller
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Thin HTTP adapter. By the time a handler runs, `validate()` (wired in
 * routes.ts) has already parsed and replaced `req.body`. Each handler does
 * nothing but: instantiate `AuthService`, call exactly one service method,
 * and respond via `ApiResponseHelper`. No business logic, no Prisma. Mirrors
 * `modules/crm/controller/lead.controller.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
function requestMeta(req: Request): RequestMeta {
  return { ipAddress: req.ip ?? null, userAgent: req.headers['user-agent'] ?? null };
}

export class AuthController {
  static login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new AuthService(req);
    const result = await service.login(req.body as LoginDto, requestMeta(req));

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, result, MESSAGES.LOGIN_SUCCESS));
  });

  static refresh = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new AuthService(req);
    const result = await service.refresh(req.body as RefreshTokenDto, requestMeta(req));

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, result, MESSAGES.TOKEN_REFRESHED));
  });

  static logout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new AuthService(req);
    await service.logout(req.body as LogoutDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, null, MESSAGES.LOGOUT_SUCCESS));
  });

  static me = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new AuthService(req);
    const result = await service.me();

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, result, MESSAGES.FETCHED));
  });

  static changePassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new AuthService(req);
    await service.changePassword(req.body as ChangePasswordDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, null, MESSAGES.PASSWORD_CHANGED));
  });

  static listSessions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new AuthService(req);
    const result = await service.listSessions();

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, result, MESSAGES.FETCHED));
  });

  static revokeSession = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new AuthService(req);
    await service.revokeSession(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, null, MESSAGES.SUCCESS));
  });

  static revokeAllSessions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new AuthService(req);
    const result = await service.logoutAllSessions(req.body as RevokeAllSessionsDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, result, MESSAGES.LOGOUT_SUCCESS));
  });
}
