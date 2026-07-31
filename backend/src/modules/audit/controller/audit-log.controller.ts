import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { AuditLogService } from '../service/audit-log.service';
import { AuditMapper } from '../mapper/audit.mapper';
import { ListAuditLogsQueryDto } from '../dto/audit.req.dto';

/**
 * Thin HTTP adapter. Mirrors `modules/notifications/controller/notification.controller.ts`.
 */
export class AuditLogController {
  static list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new AuditLogService(req);
    const { data, meta } = await service.listAuditLogs(req.query as unknown as ListAuditLogsQueryDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.paginated(req, AuditMapper.toResponseDtoList(data), meta));
  });

  static getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new AuditLogService(req);
    const entry = await service.getAuditLogById(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, AuditMapper.toResponseDto(entry), MESSAGES.FETCHED));
  });
}
