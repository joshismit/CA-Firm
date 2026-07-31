// Zod schemas for master-admin forms and API payload/response validation.

import { z } from 'zod'

export const masterAdminLoginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export type MasterAdminLoginFormValues = z.infer<typeof masterAdminLoginSchema>
