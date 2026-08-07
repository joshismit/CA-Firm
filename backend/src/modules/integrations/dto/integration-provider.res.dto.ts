import { IntegrationCategory } from '@prisma/client';
import { IntegrationCapabilities } from '../providers';

export interface IntegrationProviderResponseDto {
  key: string;
  name: string;
  category: IntegrationCategory;
  description: string | null;
  /** Master-admin platform-level kill switch — see `IntegrationProvider.isActive`'s schema comment. */
  isActive: boolean;
  /** Whether a real `IntegrationProvider` (TS) implementation is currently registered for this key
   *  (`integrationProviderRegistry.isRegistered`) — `false` for every provider today, PRD §17 ships
   *  the framework only. The frontend uses this to show a "Coming soon" badge. */
  isRegistered: boolean;
  capabilities: IntegrationCapabilities | null;
}
