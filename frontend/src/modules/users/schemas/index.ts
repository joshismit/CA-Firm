// Zod schemas for users forms and API payload/response validation.

import { z } from 'zod'

export const userStatusValues = ['ACTIVE', 'INACTIVE', 'INVITED', 'SUSPENDED', 'DELETED'] as const

export const inviteUserSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  roleIds: z.array(z.string().uuid()).min(1, 'Assign at least one role'),
  message: z.string().trim().max(500).optional(),
})

export const updateUserSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().max(30).optional(),
  jobTitle: z.string().trim().max(100).optional(),
  status: z.enum(userStatusValues).optional(),
})

export type InviteUserFormValues = z.infer<typeof inviteUserSchema>
export type UpdateUserFormValues = z.infer<typeof updateUserSchema>
