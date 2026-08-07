import { z } from 'zod';
import { PaymentGatewayProviderType } from '@prisma/client';

/**
 * `keySecret`/`webhookSecret` are write-only — accepted here, never present
 * on any response DTO (see `PaymentGatewaySettingsMapper`). Omitting either
 * on a PATCH leaves the currently-stored encrypted value untouched
 * (`PaymentGatewaySettingsService.updateSettings()`), so a firm can flip
 * `enabled`/`isTestMode` without re-entering credentials every time.
 */
export const updatePaymentGatewaySettingsSchema = z.object({
  enabled: z.boolean().optional(),
  provider: z.nativeEnum(PaymentGatewayProviderType).optional(),
  keyId: z.string().trim().max(255).optional(),
  keySecret: z.string().trim().min(1).max(500).optional(),
  webhookSecret: z.string().trim().min(1).max(500).optional(),
  isTestMode: z.boolean().optional(),
});
