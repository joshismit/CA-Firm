// src/modules/tasks/components/StaffAssigneePicker.tsx
// Replaces raw-UUID assignee text inputs with a real picker, backed by
// GET /tasks/assignable-staff - eligible staff scoped to the caller's own
// client (CLIENT users) or the given business/client (staff), never a flat
// unscoped user list.
import { Select } from '@/components/ui/select'
import { useAssignableStaffQuery } from '../hooks'
import type { AssignableStaffQuery } from '../types'

export interface StaffAssigneePickerProps {
  value?: string
  onChange: (value: string) => void
  /** Scopes the picker to a specific business/client for staff callers - ignored server-side for a CLIENT caller, whose own client is always used. */
  query?: AssignableStaffQuery
  placeholder?: string
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

export function StaffAssigneePicker({
  value,
  onChange,
  query,
  placeholder = 'Select a staff member…',
  disabled,
  className,
  'aria-label': ariaLabel,
}: StaffAssigneePickerProps) {
  const { data: staff, isLoading } = useAssignableStaffQuery(query)

  const options = (staff ?? []).map((member) => ({
    value: member.id,
    label: member.lastName ? `${member.firstName} ${member.lastName}` : member.firstName,
  }))

  return (
    <Select
      value={value}
      onChange={onChange}
      options={options}
      placeholder={isLoading ? 'Loading staff…' : placeholder}
      disabled={disabled || isLoading}
      className={className}
      aria-label={ariaLabel}
    />
  )
}
