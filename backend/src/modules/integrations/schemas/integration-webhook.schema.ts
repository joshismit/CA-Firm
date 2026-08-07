import { z } from 'zod';

export const integrationWebhookParamsSchema = z.object({
  provider: z.string().trim().min(1).max(100),
  connectionId: z.string().uuid('connectionId must be a valid UUID'),
});
