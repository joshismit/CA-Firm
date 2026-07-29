// src/modules/client-billing/components/ExpenseFilters.tsx
// Filter controls for the Expenses list - rendered inside DataTable's toolbarFilters slot.
import { Select } from '@/components/ui/select'
import { EXPENSE_STATUS_LABELS, EXPENSE_CATEGORY_OPTIONS } from '../constants'
import type { ExpenseStatus } from '../types'

const STATUS_FILTER_OPTIONS = [
  { value: '__all__', label: 'All statuses' },
  ...Object.entries(EXPENSE_STATUS_LABELS).map(([value, label]) => ({ value, label })),
]

const CATEGORY_FILTER_OPTIONS = [{ value: '__all__', label: 'All categories' }, ...EXPENSE_CATEGORY_OPTIONS]

export interface ExpenseFiltersProps {
  status: ExpenseStatus | undefined
  onStatusChange: (status: ExpenseStatus | undefined) => void
  category: string | undefined
  onCategoryChange: (category: string | undefined) => void
}

export function ExpenseFilters({ status, onStatusChange, category, onCategoryChange }: ExpenseFiltersProps) {
  return (
    <>
      <Select
        value={status ?? '__all__'}
        onChange={(value) => onStatusChange(value === '__all__' ? undefined : (value as ExpenseStatus))}
        options={STATUS_FILTER_OPTIONS}
        className="h-8 w-[150px]"
        placeholder="Status"
      />
      <Select
        value={category ?? '__all__'}
        onChange={(value) => onCategoryChange(value === '__all__' ? undefined : value)}
        options={CATEGORY_FILTER_OPTIONS}
        className="h-8 w-[180px]"
        placeholder="Category"
      />
    </>
  )
}
