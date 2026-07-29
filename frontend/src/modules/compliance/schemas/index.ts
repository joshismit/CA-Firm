// Zod schemas for the generic Compliance filing form - client-side validation only. There is no
// backend schema to mirror yet (see types/index.ts's header comment), so these are deliberately
// generic/provisional field rules, not a confirmed server-side contract.
import { z } from 'zod'

export const complianceFilingStatusValues = ['DRAFT', 'PENDING', 'FILED', 'OVERDUE'] as const

export const createComplianceFilingSchema = z.object({
  reference: z.string().trim().min(2, 'Reference must be at least 2 characters').max(100),
  period: z.string().trim().min(2, 'Period must be at least 2 characters').max(50),
  dueDate: z.coerce.date().optional(),
  notes: z.string().trim().max(2000).optional(),
})

export const updateComplianceFilingSchema = createComplianceFilingSchema.partial()

export type CreateComplianceFilingFormValues = z.infer<typeof createComplianceFilingSchema>
export type UpdateComplianceFilingFormValues = z.infer<typeof updateComplianceFilingSchema>
