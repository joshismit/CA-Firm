// src/modules/users/components/UsersFilters.tsx
// Filter controls for the Users list - rendered inside DataTable's toolbarFilters slot.
import { Select } from '@/components/ui/select'
import { USER_STATUS_LABELS } from '../constants'
import type { UserStatus } from '../types'

const STATUS_FILTER_OPTIONS = [
  { value: '__all__', label: 'All statuses' },
  ...Object.entries(USER_STATUS_LABELS).map(([value, label]) => ({ value, label })),
]

export interface UsersFiltersProps {
  status: UserStatus | undefined
  onStatusChange: (status: UserStatus | undefined) => void
}

export function UsersFilters({ status, onStatusChange }: UsersFiltersProps) {
  return (
    <Select
      value={status ?? '__all__'}
      onChange={(value) => onStatusChange(value === '__all__' ? undefined : (value as UserStatus))}
      options={STATUS_FILTER_OPTIONS}
      className="h-8 w-[150px]"
      placeholder="Status"
    />
  )
}
