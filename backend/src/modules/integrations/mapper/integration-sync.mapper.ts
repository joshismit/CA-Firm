import { IntegrationSync } from '@prisma/client';
import { IntegrationSyncResponseDto } from '../dto';

export class IntegrationSyncMapper {
  static toResponseDto(sync: IntegrationSync): IntegrationSyncResponseDto {
    return {
      id: sync.id,
      connectionId: sync.connectionId,
      direction: sync.direction,
      trigger: sync.trigger,
      status: sync.status,
      isDryRun: sync.isDryRun,
      startedAt: sync.startedAt?.toISOString() ?? null,
      completedAt: sync.completedAt?.toISOString() ?? null,
      itemsProcessed: sync.itemsProcessed,
      itemsSucceeded: sync.itemsSucceeded,
      itemsFailed: sync.itemsFailed,
      conflictCount: sync.conflictCount,
      resultSummary: (sync.resultSummary as Record<string, unknown> | null) ?? null,
      errorMessage: sync.errorMessage,
      triggeredBy: sync.triggeredBy,
      createdAt: sync.createdAt.toISOString(),
    };
  }
}
