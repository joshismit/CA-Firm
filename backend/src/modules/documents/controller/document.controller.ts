import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { DocumentService } from '../service/document.service';
import { DocumentMapper } from '../mapper/document.mapper';
import {
  CreateDocumentDto,
  UpdateDocumentDto,
  ListDocumentsQueryDto,
  ShareDocumentDto,
  RequestDocumentApprovalDto,
  ApproveDocumentDto,
  RejectDocumentDto,
} from '../dto/document.req.dto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Document Controller
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Thin HTTP adapter. By the time a handler runs, `validate()` (wired in
 * routes.ts) has already parsed and replaced `req.body` / `req.params` /
 * `req.query`, and — for `upload` — `multer` (also wired in routes.ts) has
 * already parsed the multipart body and populated `req.file`. Each handler
 * does nothing but: instantiate `DocumentService`, call exactly one service
 * method, map the result through `DocumentMapper`, and respond via
 * `ApiResponseHelper`. No business logic, no Prisma, no S3 access. Mirrors
 * `modules/crm/controller/lead.controller.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class DocumentController {
  static upload = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new DocumentService(req);
    const document = await service.uploadDocument(req.body as CreateDocumentDto, req.file);

    res.status(HTTP_STATUS.CREATED).json(ApiResponseHelper.created(req, DocumentMapper.toResponseDto(document)));
  });

  static update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new DocumentService(req);
    const document = await service.updateDocument(req.params.id, req.body as UpdateDocumentDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.updated(req, DocumentMapper.toResponseDto(document)));
  });

  static delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new DocumentService(req);
    await service.deleteDocument(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.deleted(req));
  });

  static getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new DocumentService(req);
    const document = await service.getDocumentById(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, DocumentMapper.toResponseDto(document), MESSAGES.FETCHED));
  });

  static list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new DocumentService(req);
    const { data, meta } = await service.listDocuments(req.query as unknown as ListDocumentsQueryDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.paginated(req, DocumentMapper.toResponseDtoList(data), meta));
  });

  static getDownloadUrl = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new DocumentService(req);
    const downloadUrl = await service.getDownloadUrl(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, downloadUrl, MESSAGES.FETCHED));
  });

  static share = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new DocumentService(req);
    const document = await service.shareDocument(req.params.id, req.body as ShareDocumentDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, DocumentMapper.toResponseDto(document), 'Document shared successfully'));
  });

  static revokeShare = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new DocumentService(req);
    await service.revokeShare(req.params.id, req.params.userId);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.deleted(req, undefined, 'Document share revoked successfully'));
  });

  static createVersion = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new DocumentService(req);
    const document = await service.createVersion(req.params.id, req.file);

    res.status(HTTP_STATUS.CREATED).json(ApiResponseHelper.created(req, DocumentMapper.toResponseDto(document)));
  });

  static getVersionHistory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new DocumentService(req);
    const versions = await service.getVersionHistory(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, DocumentMapper.toResponseDtoList(versions), MESSAGES.FETCHED));
  });

  static requestApproval = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new DocumentService(req);
    const document = await service.requestApproval(req.params.id, req.body as RequestDocumentApprovalDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, DocumentMapper.toResponseDto(document), 'Approval requested successfully'));
  });

  static approve = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new DocumentService(req);
    const document = await service.approve(req.params.id, req.body as ApproveDocumentDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, DocumentMapper.toResponseDto(document), 'Document approved successfully'));
  });

  static reject = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new DocumentService(req);
    const document = await service.reject(req.params.id, req.body as RejectDocumentDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, DocumentMapper.toResponseDto(document), 'Document rejected successfully'));
  });
}
