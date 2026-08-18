import { z } from 'zod';
import { updateTenantBrandingSchema, uploadBrandingAssetSchema, resolvePublicBrandingQuerySchema } from '../schemas/branding.schema';

export type UpdateTenantBrandingDto = z.infer<typeof updateTenantBrandingSchema>;
export type UploadBrandingAssetDto = z.infer<typeof uploadBrandingAssetSchema>;
export type ResolvePublicBrandingQueryDto = z.infer<typeof resolvePublicBrandingQuerySchema>;
