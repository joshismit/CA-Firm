import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { InvoiceService } from '../service/invoice.service';
import { InvoiceMapper } from '../mapper/invoice.mapper';
import { CreateInvoiceDto, UpdateInvoiceDto, ListInvoicesQueryDto } from '../dto/invoice.req.dto';

/**
 * Thin HTTP adapter. Mirrors `modules/contacts/controller/contact.controller.ts`.
 */
export class InvoiceController {
  static list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new InvoiceService(req);
    const { data, meta } = await service.listInvoices(req.query as unknown as ListInvoicesQueryDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.paginated(req, InvoiceMapper.toResponseDtoList(data), meta));
  });

  static getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new InvoiceService(req);
    const invoice = await service.getInvoiceById(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, InvoiceMapper.toResponseDto(invoice), MESSAGES.FETCHED));
  });

  static create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new InvoiceService(req);
    const invoice = await service.createInvoice(req.body as CreateInvoiceDto);

    res.status(HTTP_STATUS.CREATED).json(ApiResponseHelper.created(req, InvoiceMapper.toResponseDto(invoice)));
  });

  static update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new InvoiceService(req);
    const invoice = await service.updateInvoice(req.params.id, req.body as UpdateInvoiceDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.updated(req, InvoiceMapper.toResponseDto(invoice)));
  });

  static delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new InvoiceService(req);
    await service.deleteInvoice(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.deleted(req));
  });
}
