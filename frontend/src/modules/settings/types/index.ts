// TypeScript types and interfaces scoped to settings.
//
// NOT YET AVAILABLE: there is no backend module for firm-wide settings (backend/src/modules/tenant
// is an empty stub - no routes are mounted for it at all, see backend/src/app.ts). Every shape
// below is a deliberately generic, provisional placeholder - not a confirmed backend contract.
// Profile settings (frontend/src/modules/settings/pages/ProfileSettingsPage.tsx) is the one
// exception - it composes the real GET /auth/me, POST /auth/change-password, and /auth/sessions*
// endpoints from modules/auth, which genuinely exist.

export interface FirmSettings {
  name: string
  legalName: string | null
  gstin: string | null
  pan: string | null
  addressLine1: string | null
  city: string | null
  state: string | null
  pincode: string | null
  phone: string | null
  email: string | null
  website: string | null
}

export type UpdateFirmSettingsPayload = Partial<FirmSettings>

export type WeekStartDay = 'MONDAY' | 'SUNDAY'

export interface TeamSettings {
  allowSelfRegistration: boolean
  defaultTaskReminderDays: number
  weekStartDay: WeekStartDay
}

export type UpdateTeamSettingsPayload = Partial<TeamSettings>

export type IntegrationProvider = 'EMAIL' | 'SMS' | 'PAYMENT_GATEWAY' | 'STORAGE'

export interface IntegrationConnection {
  provider: IntegrationProvider
  isConnected: boolean
  connectedAt: string | null
}
