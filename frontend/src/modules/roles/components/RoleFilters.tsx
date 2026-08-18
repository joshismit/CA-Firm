// src/modules/roles/components/RoleFilters.tsx
// Filter controls for the Roles list - rendered inside DataTable's toolbarFilters slot.
import { Select } from '@/components/ui/select'
import { ROLE_TYPE_LABELS } from '../constants'
import type { RoleType } from '../types'

const TYPE_FILTER_OPTIONS = [
  { value: '__all__', label: 'All types' },
  ...Object.entries(ROLE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
]

export interface RoleFiltersProps {
  type: RoleType | undefined
  onTypeChange: (type: RoleType | undefined) => void
}

export function RoleFilters({ type, onTypeChange }: RoleFiltersProps) {
  return (
    <Select
      value={type ?? '__all__'}
      onChange={(value) => onTypeChange(value === '__all__' ? undefined : (value as RoleType))}
      options={TYPE_FILTER_OPTIONS}
      className="h-8 w-[150px]"
      placeholder="Type"
    />
  )
}
