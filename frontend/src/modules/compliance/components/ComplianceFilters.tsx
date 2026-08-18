// src/modules/compliance/components/ComplianceFilters.tsx
// Filter controls for the Compliance list - rendered inside DataTable's toolbarFilters slot, same
// composition as BusinessFilters/ProjectFilters. Only `status` is wired (the one real dimension the
// generic ComplianceFilingListFilters type defines beyond pagination/search/sort).
import { Select } from '@/components/ui/select'
import { COMPLIANCE_STATUS_LABELS } from '../constants'
import type { ComplianceFilingStatus } from '../types'

const STATUS_FILTER_OPTIONS = [
  { value: '__all__', label: 'All statuses' },
  ...Object.entries(COMPLIANCE_STATUS_LABELS).map(([value, label]) => ({ value, label })),
]

export interface ComplianceFiltersProps {
  status: ComplianceFilingStatus | undefined
  onStatusChange: (status: ComplianceFilingStatus | undefined) => void
}

export function ComplianceFilters({ status, onStatusChange }: ComplianceFiltersProps) {
  return (
    <Select
      value={status ?? '__all__'}
      onChange={(value) => onStatusChange(value === '__all__' ? undefined : (value as ComplianceFilingStatus))}
      options={STATUS_FILTER_OPTIONS}
      className="h-8 w-[150px]"
      placeholder="Status"
    />
  )
}
