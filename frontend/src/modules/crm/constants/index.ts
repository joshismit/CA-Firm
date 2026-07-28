// crm-scoped constants (enums, option lists, default values).

export const LEAD_ACTIVITY_LABELS: Record<string, string> = {
  CALL: 'Call',
  MEETING: 'Meeting',
  EMAIL: 'Email',
  WHATSAPP: 'WhatsApp',
  SYSTEM_LOG: 'System Log',
}

export const LEAD_ACTIVITY_OPTIONS = Object.entries(LEAD_ACTIVITY_LABELS).map(([value, label]) => ({ value, label }))
