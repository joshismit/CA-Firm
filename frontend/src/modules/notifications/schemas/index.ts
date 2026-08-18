// Zod schemas for notifications forms and API payload/response validation.

import { z } from 'zod'

export const notificationChannelValues = ['WHATSAPP', 'EMAIL', 'SMS', 'IN_APP'] as const

export const updateNotificationPreferenceSchema = z.object({
  channel: z.enum(notificationChannelValues),
  enabled: z.boolean(),
})

export type UpdateNotificationPreferenceFormValues = z.infer<typeof updateNotificationPreferenceSchema>
