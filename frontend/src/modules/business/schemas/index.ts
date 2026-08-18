// Zod schemas for business forms and API payload/response validation.

import { z } from 'zod'

export const businessStatusValues = ['ACTIVE', 'INACTIVE', 'DORMANT', 'STRUCK_OFF', 'DISSOLVED'] as const

export const createBusinessSchema = z.object({
  typeId: z.string().uuid('Select a business type'),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(255),
  legalName: z.string().trim().max(255).optional(),
  pan: z
    .string()
    .trim()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Enter a valid PAN')
    .optional()
    .or(z.literal('')),
  gstin: z
    .string()
    .trim()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'Enter a valid GSTIN')
    .optional()
    .or(z.literal('')),
  cin: z.string().trim().max(21).optional(),
  incorporationDate: z.coerce.date().optional(),
  financialYearStart: z.coerce.number().int().min(1).max(12).optional(),
  industry: z.string().trim().max(100).optional(),
})

export const updateBusinessSchema = createBusinessSchema.omit({ typeId: true }).partial()

export type CreateBusinessFormValues = z.infer<typeof createBusinessSchema>
export type UpdateBusinessFormValues = z.infer<typeof updateBusinessSchema>
