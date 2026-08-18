import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { MasterAdminAuditService } from '../service/master-admin-audit.service';
import { ListMasterAdminAuditLogsQueryDto } from '../dto/master-admin.req.dto';

/**
 * Thin HTTP adapter for the cross-tenant audit view — mirrors
 * `modules/audit/controller/audit-log.controller.ts`'s shape exactly (same
 * two handlers, same response helpers), the only difference being which
 * service backs it.
 */
export class MasterAdminAuditController {
  static list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new MasterAdminAuditService(req);
    const { data, meta } = await service.listAuditLogs(req.query as unknown as ListMasterAdminAuditLogsQueryDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.paginated(req, data, meta));
  });

  static getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new MasterAdminAuditService(req);
    const entry = await service.getAuditLogById(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, entry, MESSAGES.FETCHED));
  });
}
