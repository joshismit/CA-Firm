import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { PaymentGatewaySettingsService } from '../service/payment-gateway-settings.service';
import { UpdatePaymentGatewaySettingsDto } from '../dto/payment-gateway-settings.req.dto';

/** Thin HTTP adapter. Mirrors `modules/tenant/controller/storage-settings.controller.ts`. */
export class PaymentGatewaySettingsController {
  static get = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new PaymentGatewaySettingsService(req);
    const settings = await service.getSettings();

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, settings, MESSAGES.FETCHED));
  });

  static update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new PaymentGatewaySettingsService(req);
    const settings = await service.updateSettings(req.body as UpdatePaymentGatewaySettingsDto);

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.updated(req, settings));
  });

  static health = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new PaymentGatewaySettingsService(req);
    const health = await service.getHealth();

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, health, MESSAGES.FETCHED));
  });

  static capabilities = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new PaymentGatewaySettingsService(req);
    const capabilities = await service.getCapabilities();

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, capabilities, MESSAGES.FETCHED));
  });
}
