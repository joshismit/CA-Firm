// Zod schemas for billing forms and API payload/response validation.

import { z } from 'zod'

export const billingCycleValues = ['MONTHLY', 'QUARTERLY', 'YEARLY'] as const

export const createCheckoutSessionSchema = z.object({
  planCode: z.string().trim().min(1, 'Select a plan'),
  billingCycle: z.enum(billingCycleValues),
})

export type CreateCheckoutSessionFormValues = z.infer<typeof createCheckoutSessionSchema>
