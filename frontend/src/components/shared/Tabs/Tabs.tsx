// src/components/shared/Tabs/Tabs.tsx
import { cn } from '@/lib/utils'

export interface TabItem {
  value: string
  label: string
  badge?: number | string
}

interface TabsProps {
  tabs: TabItem[]
  value: string
  onChange: (value: string) => void
  className?: string
}

/**
 * Underline tab bar with an indigo active indicator. Controlled via
 * `value`/`onChange`; each tab may carry a count `badge`.
 */
export function Tabs({ tabs, value, onChange, className }: TabsProps) {
  return (
    <div className={cn('flex items-center gap-1 border-b border-[var(--color-border)]', className)}>
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={cn(
              '-mb-px inline-flex h-[34px] items-center gap-1.5 border-b-2 px-3',
              'text-[13px] font-medium transition-colors duration-150',
              active
                ? 'border-[var(--color-primary-600)] text-[var(--color-primary-700)]'
                : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-body)]'
            )}
          >
            {tab.label}
            {tab.badge != null && (
              <span
                className={cn(
                  'inline-flex h-[18px] min-w-[18px] items-center justify-center px-1.5',
                  'rounded-[var(--radius-full)] text-[10px] font-semibold',
                  active
                    ? 'bg-[var(--color-primary-100)] text-[var(--color-primary-700)]'
                    : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]'
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
