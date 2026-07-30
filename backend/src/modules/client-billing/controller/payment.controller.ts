import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { PaymentService } from '../service/payment.service';
import { PaymentMapper } from '../mapper/payment.mapper';
import { CreatePaymentDto, UpdatePaymentDto, ListPaymentsQueryDto } from '../dto/payment.req.dto';

/**
 * Thin HTTP adapter. Mirrors `modules/contacts/controller/contact.controller.ts`.
 */
export class PaymentController {
  static list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new PaymentService(req);
    const { data, meta } = await service.listPayments(req.query as unknown as ListPaymentsQueryDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.paginated(req, PaymentMapper.toResponseDtoList(data), meta));
  });

  static getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new PaymentService(req);
    const payment = await service.getPaymentById(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, PaymentMapper.toResponseDto(payment), MESSAGES.FETCHED));
  });

  static create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new PaymentService(req);
    const payment = await service.createPayment(req.body as CreatePaymentDto);

    res.status(HTTP_STATUS.CREATED).json(ApiResponseHelper.created(req, PaymentMapper.toResponseDto(payment)));
  });

  static update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new PaymentService(req);
    const payment = await service.updatePayment(req.params.id, req.body as UpdatePaymentDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.updated(req, PaymentMapper.toResponseDto(payment)));
  });

  static delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new PaymentService(req);
    await service.deletePayment(req.params.id);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.deleted(req));
  });
}
