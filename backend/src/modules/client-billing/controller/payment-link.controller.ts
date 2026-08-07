import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { PaymentLinkService } from '../service/payment-link.service';
import { CreatePaymentLinkDto, ListPaymentLinksQueryDto } from '../dto/payment-link.req.dto';

export class PaymentLinkController {
  static list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new PaymentLinkService(req);
    const { invoiceId } = req.query as unknown as ListPaymentLinksQueryDto;
    const links = await service.listByInvoice(invoiceId);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, links, MESSAGES.FETCHED));
  });

  static create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new PaymentLinkService(req);
    const link = await service.generatePaymentLink(req.body as CreatePaymentLinkDto);

    res.status(HTTP_STATUS.CREATED).json(ApiResponseHelper.created(req, link));
  });
}
