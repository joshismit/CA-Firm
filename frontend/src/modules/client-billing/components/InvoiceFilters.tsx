// src/modules/client-billing/components/InvoiceFilters.tsx
// Filter controls for the Invoices list - rendered inside DataTable's toolbarFilters slot.
import { Select } from '@/components/ui/select'
import { INVOICE_STATUS_LABELS } from '../constants'
import type { InvoiceStatus } from '../types'

const STATUS_FILTER_OPTIONS = [
  { value: '__all__', label: 'All statuses' },
  ...Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => ({ value, label })),
]

export interface InvoiceFiltersProps {
  status: InvoiceStatus | undefined
  onStatusChange: (status: InvoiceStatus | undefined) => void
}

export function InvoiceFilters({ status, onStatusChange }: InvoiceFiltersProps) {
  return (
    <Select
      value={status ?? '__all__'}
      onChange={(value) => onStatusChange(value === '__all__' ? undefined : (value as InvoiceStatus))}
      options={STATUS_FILTER_OPTIONS}
      className="h-8 w-[150px]"
      placeholder="Status"
    />
  )
}
