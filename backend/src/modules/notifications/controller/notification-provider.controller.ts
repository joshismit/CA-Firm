import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { getAllProviders } from '../providers';
import { NotificationProviderResponseDto, NotificationProviderHealthResponseDto } from '../dto/notification-provider.res.dto';

/** PRD §11.16 — thin, read-only adapter over `getAllProviders()`. No service/repository layer — there is no persisted state here, just the in-process provider singletons. */
export class NotificationProviderController {
  static list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const providers = getAllProviders();
    const dtos: NotificationProviderResponseDto[] = Object.entries(providers).map(([channel, provider]) => ({
      channel: channel as NotificationProviderResponseDto['channel'],
      isConfigured: provider.isConfigured,
      capabilities: provider.getCapabilities(),
    }));

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, dtos, MESSAGES.FETCHED));
  });

  static health = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const providers = getAllProviders();
    const entries = await Promise.all(
      Object.entries(providers).map(async ([channel, provider]): Promise<NotificationProviderHealthResponseDto> => ({
        channel: channel as NotificationProviderHealthResponseDto['channel'],
        health: await provider.health(),
      })),
    );

    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, entries, MESSAGES.FETCHED));
  });
}
