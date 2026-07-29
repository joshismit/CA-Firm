// Zod schemas for settings forms - client-side validation only. There is no backend schema to
// mirror yet (see types/index.ts's header comment), so these are deliberately generic/provisional
// field rules, not a confirmed server-side contract.
import { z } from 'zod'

export const updateFirmSettingsSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(255),
  legalName: z.string().trim().max(255).optional(),
  gstin: z
    .string()
    .trim()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'Enter a valid GSTIN')
    .optional()
    .or(z.literal('')),
  pan: z
    .string()
    .trim()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Enter a valid PAN')
    .optional()
    .or(z.literal('')),
  addressLine1: z.string().trim().max(255).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  pincode: z.string().trim().max(10).optional(),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().email('Enter a valid email address').optional().or(z.literal('')),
  website: z.string().trim().max(255).optional(),
})

export type UpdateFirmSettingsFormValues = z.infer<typeof updateFirmSettingsSchema>

export const updateTeamSettingsSchema = z.object({
  allowSelfRegistration: z.boolean(),
  defaultTaskReminderDays: z.coerce.number().int().min(0).max(30),
  weekStartDay: z.enum(['MONDAY', 'SUNDAY']),
})

export type UpdateTeamSettingsFormValues = z.infer<typeof updateTeamSettingsSchema>
