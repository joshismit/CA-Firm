import { z } from 'zod';
import { createTenantDomainSchema } from '../schemas/domain.schema';

export type CreateTenantDomainDto = z.infer<typeof createTenantDomainSchema>;
