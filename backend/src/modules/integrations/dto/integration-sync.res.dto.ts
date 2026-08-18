import { IntegrationSyncDirection, IntegrationSyncTrigger, IntegrationSyncStatus } from '@prisma/client';

export interface IntegrationSyncResponseDto {
  id: string;
  connectionId: string;
  direction: IntegrationSyncDirection;
  trigger: IntegrationSyncTrigger;
  status: IntegrationSyncStatus;
  isDryRun: boolean;
  startedAt: string | null;
  completedAt: string | null;
  itemsProcessed: number;
  itemsSucceeded: number;
  itemsFailed: number;
  conflictCount: number;
  resultSummary: Record<string, unknown> | null;
  errorMessage: string | null;
  triggeredBy: string | null;
  createdAt: string;
}
