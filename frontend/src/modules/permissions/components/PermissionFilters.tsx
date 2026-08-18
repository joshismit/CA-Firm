// src/modules/permissions/components/PermissionFilters.tsx
// Filter controls for the Permissions catalog - options built from the real, already-established
// PERMISSION_RESOURCES/PERMISSION_ACTIONS registry (config/permissions.config.ts), not invented.
import { Select } from '@/components/ui/select'
import { PERMISSION_RESOURCES, PERMISSION_ACTIONS } from '../constants'

const RESOURCE_OPTIONS = [
  { value: '__all__', label: 'All resources' },
  ...Object.values(PERMISSION_RESOURCES).map((value) => ({ value, label: value })),
]

const ACTION_OPTIONS = [
  { value: '__all__', label: 'All actions' },
  ...Object.values(PERMISSION_ACTIONS).map((value) => ({ value, label: value })),
]

export interface PermissionFiltersProps {
  resource: string | undefined
  onResourceChange: (resource: string | undefined) => void
  action: string | undefined
  onActionChange: (action: string | undefined) => void
}

export function PermissionFilters({ resource, onResourceChange, action, onActionChange }: PermissionFiltersProps) {
  return (
    <>
      <Select
        value={resource ?? '__all__'}
        onChange={(value) => onResourceChange(value === '__all__' ? undefined : value)}
        options={RESOURCE_OPTIONS}
        className="h-8 w-[160px]"
        placeholder="Resource"
      />
      <Select
        value={action ?? '__all__'}
        onChange={(value) => onActionChange(value === '__all__' ? undefined : value)}
        options={ACTION_OPTIONS}
        className="h-8 w-[150px]"
        placeholder="Action"
      />
    </>
  )
}
