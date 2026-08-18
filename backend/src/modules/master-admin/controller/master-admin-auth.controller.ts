import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { MasterAdminAuthService } from '../service/master-admin-auth.service';
import { MasterAdminLoginDto } from '../dto/master-admin.req.dto';

/**
 * Thin HTTP adapter — mirrors `modules/auth/controller/auth.controller.ts`'s
 * `login` handler. No mapper: `MasterAdminAuthService.login()` already
 * returns the response DTO shape directly (nothing to translate from a raw
 * Prisma row here, unlike the tenant-CRUD controller in this same module).
 */
export class MasterAdminAuthController {
  static login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new MasterAdminAuthService(req);
    const result = await service.login(req.body as MasterAdminLoginDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, result, MESSAGES.LOGIN_SUCCESS));
  });
}
