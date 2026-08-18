import { Request, Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '@shared/constants';
import { ApiResponseHelper } from '@shared/response/api-response';
import { asyncHandler } from '@shared/utils';
import { IntegrationProviderCatalogService } from '../service/integration-provider-catalog.service';
import { IntegrationConnectionService } from '../service/integration-connection.service';
import { IntegrationSyncHistoryService } from '../service/integration-sync-history.service';
import {
  ConnectIntegrationDto,
  DisconnectIntegrationDto,
  TriggerSyncDto,
  ListConnectionsQueryDto,
  SyncHistoryQueryDto,
  HealthQueryDto,
} from '../dto';

/**
 * The one controller business modules/frontend actually call — every method
 * here delegates to a request-scoped service, which in turn only ever talks
 * to `integrationProviderRegistry`, never a concrete provider (PRD §17 Step 3:
 * "Business modules communicate only with `IntegrationService`").
 */
export class IntegrationController {
  static listProviders = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new IntegrationProviderCatalogService(req);
    const providers = await service.listProviders();
    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, providers, MESSAGES.FETCHED));
  });

  static listConnections = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new IntegrationConnectionService(req);
    const { providerKey } = req.query as unknown as ListConnectionsQueryDto;
    const connections = await service.listConnections(providerKey);
    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, connections, MESSAGES.FETCHED));
  });

  static connect = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new IntegrationConnectionService(req);
    const connection = await service.connect(req.body as ConnectIntegrationDto);
    res.status(HTTP_STATUS.CREATED).json(ApiResponseHelper.created(req, connection));
  });

  static disconnect = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new IntegrationConnectionService(req);
    const { connectionId } = req.body as DisconnectIntegrationDto;
    const connection = await service.disconnect(connectionId);
    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, connection, MESSAGES.UPDATED));
  });

  static triggerSync = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new IntegrationSyncHistoryService(req);
    const { connectionId, direction, isDryRun } = req.body as TriggerSyncDto;
    const sync = await service.triggerSync({ connectionId, direction, isDryRun });
    res.status(HTTP_STATUS.ACCEPTED).json(ApiResponseHelper.success(req, sync, 'Sync queued'));
  });

  static syncHistory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new IntegrationSyncHistoryService(req);
    const { connectionId, page, limit, sortBy, sortOrder } = req.query as unknown as SyncHistoryQueryDto;
    const { data, meta } = await service.getHistory(connectionId, {
      page: page ?? 1,
      limit: limit ?? 20,
      sortBy,
      sortOrder,
    });
    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.paginated(req, data, meta));
  });

  static health = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = new IntegrationConnectionService(req);
    const { connectionId } = req.query as unknown as HealthQueryDto;
    const health = await service.getHealth(connectionId);
    res.status(HTTP_STATUS.OK).json(ApiResponseHelper.success(req, health, MESSAGES.FETCHED));
  });
}
