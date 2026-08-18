import { z } from 'zod';
import { updatePaymentGatewaySettingsSchema } from '../schemas/payment-gateway-settings.schema';

export type UpdatePaymentGatewaySettingsDto = z.infer<typeof updatePaymentGatewaySettingsSchema>;
