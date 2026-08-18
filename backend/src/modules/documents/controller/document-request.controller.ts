import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { DocumentRequestService } from '../service/document-request.service';
import { DocumentRequestMapper } from '../mapper/document-request.mapper';
import {
  CreateDocumentRequestDto,
  UpdateDocumentRequestDto,
  FulfillDocumentRequestDto,
  ListDocumentRequestsQueryDto,
} from '../dto/document-request.req.dto';

/** Thin HTTP adapter. Mirrors `modules/documents/controller/document-folder.controller.ts`. */
export class DocumentRequestController {
  static create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new DocumentRequestService(req);
    const request = await service.createRequest(req.body as CreateDocumentRequestDto);

    res.status(HTTP_STATUS.CREATED).json(ApiResponseHelper.created(req, DocumentRequestMapper.toResponseDto(request)));
  });

  static list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new DocumentRequestService(req);
    const { data, meta } = await service.listRequests(req.query as unknown as ListDocumentRequestsQueryDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.paginated(req, DocumentRequestMapper.toResponseDtoList(data), meta));
  });

  static getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new DocumentRequestService(req);
    const request = await service.getRequestById(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, DocumentRequestMapper.toResponseDto(request), MESSAGES.FETCHED));
  });

  static update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new DocumentRequestService(req);
    const request = await service.updateRequest(req.params.id, req.body as UpdateDocumentRequestDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.updated(req, DocumentRequestMapper.toResponseDto(request)));
  });

  static fulfill = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new DocumentRequestService(req);
    const request = await service.fulfillRequest(req.params.id, req.body as FulfillDocumentRequestDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.updated(req, DocumentRequestMapper.toResponseDto(request)));
  });

  static cancel = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new DocumentRequestService(req);
    const request = await service.cancelRequest(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.updated(req, DocumentRequestMapper.toResponseDto(request)));
  });
}
