// settings-scoped constants (enums, option lists, default values).
import { Mail, MessageSquare, CreditCard, HardDrive, type LucideIcon } from 'lucide-react'
import type { IntegrationProvider, WeekStartDay } from '../types'

export const WEEK_START_OPTIONS: { value: WeekStartDay; label: string }[] = [
  { value: 'MONDAY', label: 'Monday' },
  { value: 'SUNDAY', label: 'Sunday' },
]

export interface IntegrationProviderConfig {
  provider: IntegrationProvider
  label: string
  description: string
  icon: LucideIcon
}

export const INTEGRATION_PROVIDERS: IntegrationProviderConfig[] = [
  { provider: 'EMAIL', label: 'Email Provider', description: 'Send transactional email (invoices, notifications) via SMTP or a provider API.', icon: Mail },
  { provider: 'SMS', label: 'SMS Provider', description: 'Send SMS reminders and OTPs to clients and staff.', icon: MessageSquare },
  { provider: 'PAYMENT_GATEWAY', label: 'Payment Gateway', description: 'Accept online payments against invoices.', icon: CreditCard },
  { provider: 'STORAGE', label: 'Storage Provider', description: 'Where uploaded documents are stored (currently local/default).', icon: HardDrive },
]
