// Zod schemas for roles forms and API payload/response validation.

import { z } from 'zod'

export const createRoleSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  description: z.string().trim().max(500).optional(),
  color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, 'Enter a valid hex color').optional(),
  permissionCodes: z.array(z.string()).min(1, 'Assign at least one permission'),
})

export const updateRoleSchema = createRoleSchema.partial()

export const assignRoleSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
  expiresAt: z.coerce.date().optional(),
})

export type CreateRoleFormValues = z.infer<typeof createRoleSchema>
export type UpdateRoleFormValues = z.infer<typeof updateRoleSchema>
export type AssignRoleFormValues = z.infer<typeof assignRoleSchema>
