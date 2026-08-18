// Zod schemas for master-admin forms and API payload/response validation.

import { z } from 'zod'

export const masterAdminLoginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export type MasterAdminLoginFormValues = z.infer<typeof masterAdminLoginSchema>

// Mirrors backend/src/modules/master-admin/schemas/master-admin.schema.ts's createTenantSchema.
export const createTenantSchema = z.object({
  name: z.string().trim().min(1, 'Firm name is required').max(255, 'Firm name cannot exceed 255 characters'),
  ownerFirstName: z.string().trim().min(1, 'Owner first name is required').max(100, 'Owner first name cannot exceed 100 characters'),
  ownerLastName: z.string().trim().min(1, 'Owner last name is required').max(100, 'Owner last name cannot exceed 100 characters'),
  ownerEmail: z.string().trim().min(1, 'Owner email is required').email('Enter a valid email address'),
})

export type CreateTenantFormValues = z.infer<typeof createTenantSchema>
