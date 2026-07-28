// src/modules/business/components/BusinessFilters.tsx
// Filter controls for the Business list - rendered inside DataTable's toolbarFilters slot.
import { Select } from '@/components/ui/select'
import { BUSINESS_STATUS_LABELS } from '../constants'
import type { BusinessStatus } from '../types'

const STATUS_FILTER_OPTIONS = [
  { value: '__all__', label: 'All statuses' },
  ...Object.entries(BUSINESS_STATUS_LABELS).map(([value, label]) => ({ value, label })),
]

export interface BusinessFiltersProps {
  status: BusinessStatus | undefined
  onStatusChange: (status: BusinessStatus | undefined) => void
}

export function BusinessFilters({ status, onStatusChange }: BusinessFiltersProps) {
  return (
    <Select
      value={status ?? '__all__'}
      onChange={(value) => onStatusChange(value === '__all__' ? undefined : (value as BusinessStatus))}
      options={STATUS_FILTER_OPTIONS}
      className="h-8 w-[160px]"
      placeholder="Status"
    />
  )
}
