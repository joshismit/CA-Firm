import { z } from 'zod';
import {
  createComplianceFilingSchema,
  updateComplianceFilingSchema,
  complianceFilingIdParamSchema,
  listComplianceFilingsQuerySchema,
} from '../schemas/compliance-filing.schema';

/**
 * Request DTOs — inferred from the Zod schemas in
 * `schemas/compliance-filing.schema.ts`. These are the shapes controllers/
 * services receive AFTER `validate()` has run.
 */

export type CreateComplianceFilingDto = z.infer<typeof createComplianceFilingSchema>;
export type UpdateComplianceFilingDto = z.infer<typeof updateComplianceFilingSchema>;
export type ComplianceFilingIdParamDto = z.infer<typeof complianceFilingIdParamSchema>;
export type ListComplianceFilingsQueryDto = z.infer<typeof listComplianceFilingsQuerySchema>;
