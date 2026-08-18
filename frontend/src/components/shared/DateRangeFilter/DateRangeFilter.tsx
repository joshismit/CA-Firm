// src/components/shared/DateRangeFilter/DateRangeFilter.tsx
// Generic "From / To" date-range control - reusable anywhere a list needs to filter by a date
// span (Reports' generate-page filters and Audit Logs' list filters both need this exact shape).
// Plain native date inputs, same visual weight as Input elsewhere - no new form primitive.
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export interface DateRangeFilterProps {
  from: string | undefined
  to: string | undefined
  onFromChange: (value: string | undefined) => void
  onToChange: (value: string | undefined) => void
  fromLabel?: string
  toLabel?: string
  className?: string
}

export function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
  fromLabel = 'From',
  toLabel = 'To',
  className,
}: DateRangeFilterProps) {
  return (
    <div className={cn('grid grid-cols-2 gap-3', className)}>
      <div className="space-y-1.5">
        <Label htmlFor="date-range-from">{fromLabel}</Label>
        <Input
          id="date-range-from"
          type="date"
          value={from ?? ''}
          onChange={(e) => onFromChange(e.target.value === '' ? undefined : e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="date-range-to">{toLabel}</Label>
        <Input
          id="date-range-to"
          type="date"
          value={to ?? ''}
          onChange={(e) => onToChange(e.target.value === '' ? undefined : e.target.value)}
        />
      </div>
    </div>
  )
}
