// src/modules/documents/components/CategoryNav.tsx
// Left-rail category navigation for the folder browser (PRD §7.1 rule 9 "category navigation") -
// a vertical list of the same DOCUMENT_CATEGORY_OPTIONS used by DocumentFilters' category Select,
// just rendered as selectable rows instead of a dropdown since this is the primary navigation axis
// on this page (Business → category → folder).
import { cn } from '@/lib/utils'
import { DOCUMENT_CATEGORY_OPTIONS } from '../constants'
import type { DocumentCategory } from '../types'

export interface CategoryNavProps {
  value: DocumentCategory
  onChange: (category: DocumentCategory) => void
}

export function CategoryNav({ value, onChange }: CategoryNavProps) {
  return (
    <nav aria-label="Document categories" className="flex flex-col gap-0.5">
      {DOCUMENT_CATEGORY_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'text-left px-3 py-1.5 rounded-[var(--radius-md)] text-[13px] font-medium transition-colors',
            option.value === value
              ? 'bg-[var(--color-primary-50)] text-[var(--color-primary-700)]'
              : 'text-[var(--color-text-body)] hover:bg-[var(--color-hover)]'
          )}
        >
          {option.label}
        </button>
      ))}
    </nav>
  )
}
