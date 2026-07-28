// Zod schemas for permissions forms and API payload/response validation.

import { z } from 'zod'

export const updatePermissionMatrixSchema = z.object({
  roleId: z.string().uuid(),
  permissionId: z.string().uuid(),
  granted: z.boolean(),
})

export type UpdatePermissionMatrixFormValues = z.infer<typeof updatePermissionMatrixSchema>
