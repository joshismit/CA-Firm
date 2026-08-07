// Zod schemas for reports forms and API payload/response validation.

import { z } from 'zod'

export const reportGroupByValues = ['SOURCE', 'OWNER', 'STAFF', 'PRIORITY', 'STATUS', 'DUE_DATE', 'BUSINESS', 'DATE'] as const

export const reportFiltersSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  staffId: z.string().uuid().optional(),
  groupBy: z.enum(reportGroupByValues).optional(),
})

export type ReportFiltersFormValues = z.infer<typeof reportFiltersSchema>
