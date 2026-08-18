import { z } from 'zod';
import { IntegrationSyncDirection } from '@prisma/client';
import { paginationSchema } from '@shared/validators/pagination.validator';

const uuid = z.string().uuid('Must be a valid UUID');
const syncDirection = z.nativeEnum(IntegrationSyncDirection);

export const connectIntegrationSchema = z.object({
  providerKey: z.string().trim().min(1).max(100),
  connectionId: uuid.optional(),
  label: z.string().trim().max(150).optional(),
  /** Opaque — the framework never validates its internal shape, only that it's a non-empty object. */
  credentials: z.record(z.string(), z.unknown()).refine((value) => Object.keys(value).length > 0, {
    message: 'credentials must not be empty',
  }),
  config: z.record(z.string(), z.unknown()).optional(),
  syncDirection: syncDirection.optional(),
  autoSyncEnabled: z.boolean().optional(),
  syncFrequencyMinutes: z.coerce.number().int().min(5).max(10080).optional(),
});

export const disconnectIntegrationSchema = z.object({
  connectionId: uuid,
});

export const triggerSyncSchema = z.object({
  connectionId: uuid,
  direction: syncDirection.optional(),
  isDryRun: z.boolean().optional(),
});

export const listConnectionsQuerySchema = z.object({
  providerKey: z.string().trim().min(1).max(100).optional(),
});

export const syncHistoryQuerySchema = paginationSchema.extend({
  connectionId: uuid.optional(),
});

export const healthQuerySchema = z.object({
  connectionId: uuid,
});
