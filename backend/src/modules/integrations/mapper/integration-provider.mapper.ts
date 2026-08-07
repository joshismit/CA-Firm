import { IntegrationProvider as IntegrationProviderRow } from '@prisma/client';
import { IntegrationProviderResponseDto } from '../dto';
import { integrationProviderRegistry } from '../providers';

export class IntegrationProviderMapper {
  static toResponseDto(row: IntegrationProviderRow): IntegrationProviderResponseDto {
    return {
      key: row.key,
      name: row.name,
      category: row.category,
      description: row.description,
      isActive: row.isActive,
      isRegistered: integrationProviderRegistry.isRegistered(row.key),
      capabilities: (row.capabilities as IntegrationProviderResponseDto['capabilities']) ?? null,
    };
  }
}
