// Zod schemas for contacts forms and API payload/response validation.

import { z } from 'zod'

export const contactRoleTypeValues = [
  'OWNER',
  'DIRECTOR',
  'PARTNER',
  'AUTHORIZED_SIGNATORY',
  'ACCOUNTANT',
  'AUDITOR',
  'EMPLOYEE',
  'CLIENT_REPRESENTATIVE',
  'EMERGENCY_CONTACT',
  'OTHER',
] as const

export const createContactSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().max(100).optional(),
  email: z.string().trim().email('Enter a valid email address').optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional(),
  pan: z
    .string()
    .trim()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Enter a valid PAN')
    .optional()
    .or(z.literal('')),
})

export const updateContactSchema = createContactSchema.partial()

export const assignContactRoleSchema = z.object({
  businessId: z.string().uuid(),
  contactId: z.string().uuid(),
  roleType: z.enum(contactRoleTypeValues),
  customTitle: z.string().trim().max(100).optional(),
  isPrimary: z.boolean().optional(),
  sharePercent: z.coerce.number().min(0).max(100).optional(),
})

export type CreateContactFormValues = z.infer<typeof createContactSchema>
export type UpdateContactFormValues = z.infer<typeof updateContactSchema>
export type AssignContactRoleFormValues = z.infer<typeof assignContactRoleSchema>
