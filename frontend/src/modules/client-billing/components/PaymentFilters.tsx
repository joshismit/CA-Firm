// src/modules/client-billing/components/PaymentFilters.tsx
// Filter controls for the Payments list - rendered inside DataTable's toolbarFilters slot.
import { Select } from '@/components/ui/select'
import { PAYMENT_STATUS_LABELS } from '../constants'
import type { PaymentStatus } from '../types'

const STATUS_FILTER_OPTIONS = [
  { value: '__all__', label: 'All statuses' },
  ...Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => ({ value, label })),
]

export interface PaymentFiltersProps {
  status: PaymentStatus | undefined
  onStatusChange: (status: PaymentStatus | undefined) => void
}

export function PaymentFilters({ status, onStatusChange }: PaymentFiltersProps) {
  return (
    <Select
      value={status ?? '__all__'}
      onChange={(value) => onStatusChange(value === '__all__' ? undefined : (value as PaymentStatus))}
      options={STATUS_FILTER_OPTIONS}
      className="h-8 w-[150px]"
      placeholder="Status"
    />
  )
}
