// notifications-scoped constants (enums, option lists, default values).

export const NOTIFICATION_CHANNEL_LABELS: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Email',
  SMS: 'SMS',
  IN_APP: 'In-App',
}

export const NOTIFICATION_CHANNEL_OPTIONS = Object.entries(NOTIFICATION_CHANNEL_LABELS).map(([value, label]) => ({
  value,
  label,
}))
