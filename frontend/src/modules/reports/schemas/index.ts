// Zod schemas for reports forms and API payload/response validation.

import { z } from 'zod'

export const reportFiltersSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  staffId: z.string().uuid().optional(),
})

export type ReportFiltersFormValues = z.infer<typeof reportFiltersSchema>
