import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { DocumentFolderService } from '../service/document-folder.service';
import { DocumentFolderMapper } from '../mapper/document-folder.mapper';
import { CreateFolderDto, UpdateFolderDto, ListFoldersQueryDto } from '../dto/document-folder.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Document Folder Controller
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Thin HTTP adapter — no business logic, no Prisma. Mirrors
 * `modules/documents/controller/document.controller.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class DocumentFolderController {
  static create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new DocumentFolderService(req);
    const folder = await service.createFolder(req.params.businessId, req.body as CreateFolderDto);

    res.status(HTTP_STATUS.CREATED).json(ApiResponseHelper.created(req, DocumentFolderMapper.toResponseDto(folder)));
  });

  static list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new DocumentFolderService(req);
    const folders = await service.listFolders(req.params.businessId, req.query as unknown as ListFoldersQueryDto);

    res
      .status(HTTP_STATUS.OK)
      .json(ApiResponseHelper.success(req, DocumentFolderMapper.toResponseDtoList(folders), MESSAGES.FETCHED));
  });

  static getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new DocumentFolderService(req);
    const folder = await service.getFolderById(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, DocumentFolderMapper.toResponseDto(folder), MESSAGES.FETCHED));
  });

  static rename = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new DocumentFolderService(req);
    const folder = await service.renameFolder(req.params.id, req.body as UpdateFolderDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.updated(req, DocumentFolderMapper.toResponseDto(folder)));
  });

  static delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new DocumentFolderService(req);
    await service.deleteFolder(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.deleted(req));
  });
}
