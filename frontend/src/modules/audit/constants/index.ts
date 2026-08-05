// audit-scoped constants (enums, option lists, default values).
// Matches PRD section 14.1's tracked-event list exactly.

export const AUDIT_EVENT_LABELS: Record<string, string> = {
  UPLOAD: 'Upload',
  DOWNLOAD: 'Download',
  SHARE: 'Share',
  LOGIN: 'Login',
  LOGOUT: 'Logout',
  ROLE_CHANGE: 'Role Change',
  TASK_UPDATE: 'Task Update',
  PAYMENT_ACTION: 'Payment Action',
  PERMISSION_CHANGE: 'Permission Change',
  PASSWORD_RESET: 'Password Reset',
  INVITATION_ACCEPTED: 'Invitation Accepted',
  TASK_REMINDER_SENT: 'Task Reminder Sent',
  SETTINGS_UPDATE: 'Settings Update',
  UPLOAD_REJECTED: 'Upload Rejected',
}

export const AUDIT_EVENT_OPTIONS = Object.entries(AUDIT_EVENT_LABELS).map(([value, label]) => ({ value, label }))
