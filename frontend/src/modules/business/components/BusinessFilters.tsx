// src/modules/business/components/BusinessFilters.tsx
// Filter controls for the Business list - rendered inside DataTable's toolbarFilters slot.
// typeId is a real Select backed by useBusinessTypesQuery() (GET /business/types, a shared
// cross-tenant reference catalog) - not a hardcoded list.
import { Select } from '@/components/ui/select'
import { useBusinessTypesQuery } from '../hooks'
import { BUSINESS_STATUS_LABELS } from '../constants'
import type { BusinessStatus } from '../types'

const STATUS_FILTER_OPTIONS = [
  { value: '__all__', label: 'All statuses' },
  ...Object.entries(BUSINESS_STATUS_LABELS).map(([value, label]) => ({ value, label })),
]

const TYPE_ALL_OPTION = { value: '__all__', label: 'All types' }

export interface BusinessFiltersProps {
  status: BusinessStatus | undefined
  onStatusChange: (status: BusinessStatus | undefined) => void
  typeId: string | undefined
  onTypeIdChange: (typeId: string | undefined) => void
}

export function BusinessFilters({ status, onStatusChange, typeId, onTypeIdChange }: BusinessFiltersProps) {
  const typesQuery = useBusinessTypesQuery()
  const typeOptions = [TYPE_ALL_OPTION, ...(typesQuery.data ?? []).map((t) => ({ value: t.id, label: t.name }))]

  return (
    <>
      <Select
        value={status ?? '__all__'}
        onChange={(value) => onStatusChange(value === '__all__' ? undefined : (value as BusinessStatus))}
        options={STATUS_FILTER_OPTIONS}
        className="h-8 w-[150px]"
        placeholder="Status"
      />
      <Select
        value={typeId ?? '__all__'}
        onChange={(value) => onTypeIdChange(value === '__all__' ? undefined : value)}
        options={typeOptions}
        disabled={typesQuery.isLoading}
        className="h-8 w-[170px]"
        placeholder="Business type"
      />
    </>
  )
}
