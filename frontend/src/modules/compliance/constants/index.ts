// compliance-scoped constants (module config, status labels).
import { FileText, Calculator, Receipt, Building2, type LucideIcon } from 'lucide-react'
import type { ComplianceFilingStatus, ComplianceModuleKey } from '../types'

export interface ComplianceModuleConfig {
  key: ComplianceModuleKey
  /** Sidebar/page title, e.g. "GST Returns". */
  label: string
  /** Singular noun for copy, e.g. "GST return". */
  singular: string
  /** Route base, matches constants/navigation.ts exactly (/gst, /itr, /tds, /mca). */
  path: string
  icon: LucideIcon
}

export const COMPLIANCE_MODULES: Record<ComplianceModuleKey, ComplianceModuleConfig> = {
  gst: { key: 'gst', label: 'GST Returns', singular: 'GST return', path: 'gst', icon: FileText },
  itr: { key: 'itr', label: 'Income Tax (ITR)', singular: 'ITR filing', path: 'itr', icon: Calculator },
  tds: { key: 'tds', label: 'TDS / 26Q', singular: 'TDS return', path: 'tds', icon: Receipt },
  mca: { key: 'mca', label: 'MCA / ROC', singular: 'MCA filing', path: 'mca', icon: Building2 },
}

export const COMPLIANCE_STATUS_LABELS: Record<ComplianceFilingStatus, string> = {
  DRAFT: 'Draft',
  PENDING: 'Pending',
  FILED: 'Filed',
  OVERDUE: 'Overdue',
}
