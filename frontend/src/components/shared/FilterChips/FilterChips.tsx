// src/components/shared/FilterChips/FilterChips.tsx
// Generic "active filters" row - one removable chip per applied filter, plus a "Clear all". Purely
// presentational; each page supplies its own chip list (built from whatever filters it already
// tracks in state) and an onRemove callback. Reusable across every module's list page instead of a
// per-module duplicate.
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FilterChip {
  key: string
  label: string
}

export interface FilterChipsProps {
  chips: FilterChip[]
  onRemove: (key: string) => void
  onClearAll?: () => void
  className?: string
}

export function FilterChips({ chips, onRemove, onClearAll, className }: FilterChipsProps) {
  if (chips.length === 0) return null

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => onRemove(chip.key)}
          aria-label={`Remove filter: ${chip.label}`}
          className={cn(
            'inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-[var(--radius-full)]',
            'text-[11px] font-medium border border-[var(--color-primary-200)]',
            'bg-[var(--color-primary-50)] text-[var(--color-primary-700)]',
            'hover:bg-[var(--color-primary-100)] transition-colors'
          )}
        >
          <span aria-hidden="true">{chip.label}</span>
          <X className="w-3 h-3" aria-hidden="true" />
        </button>
      ))}
      {onClearAll && chips.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-[11px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-body)] px-1.5 py-1"
        >
          Clear all
        </button>
      )}
    </div>
  )
}
