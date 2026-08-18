import { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '@config/database';
import { logger } from '@config/logger';
import { BaseService } from '@shared/base';
import { IntegrationProviderRepository } from '../repository';
import { IntegrationProviderMapper } from '../mapper';
import { IntegrationProviderResponseDto } from '../dto';
import { integrationProviderRegistry } from '../providers';

export class IntegrationProviderCatalogService extends BaseService {
  constructor(
    req: Request,
    private readonly providerRepository: IntegrationProviderRepository = new IntegrationProviderRepository(prisma),
  ) {
    super(req);
  }

  async listProviders(): Promise<IntegrationProviderResponseDto[]> {
    const rows = await this.providerRepository.findAll();
    return rows.map((row) => IntegrationProviderMapper.toResponseDto(row));
  }
}

/**
 * Upserts one `IntegrationProvider` catalog row per key registered with
 * `integrationProviderRegistry` — called once from `server.ts` at process
 * boot, never from a request handler. A registry with nothing registered
 * (true for every provider today — PRD §17 ships the framework only) is a
 * complete no-op: zero rows upserted, any previously-registered keys that
 * disappeared get soft-disabled (`isActive: false`), nothing is ever deleted.
 * Failure here must never block the server from starting — the catalog is a
 * read-side convenience table, not something any other boot step depends on.
 */
export async function syncIntegrationProviderCatalog(
  repository: IntegrationProviderRepository = new IntegrationProviderRepository(prisma),
): Promise<void> {
  const keys = integrationProviderRegistry.listKeys();

  for (const key of keys) {
    const metadata = integrationProviderRegistry.getMetadata(key);
    if (!metadata) continue;
    await repository.upsertByKey(key, {
      name: metadata.name,
      category: metadata.capabilities.category,
      description: metadata.description ?? null,
      capabilities: metadata.capabilities as unknown as Prisma.InputJsonValue,
    });
  }

  await repository.deactivateMissing(keys);
  logger.info({ registeredProviderCount: keys.length }, 'Integration provider catalog synced');
}
