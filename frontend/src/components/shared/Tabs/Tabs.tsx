// src/components/shared/Tabs/Tabs.tsx
import type { KeyboardEvent } from 'react'
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
 *
 * role="tablist"/"tab" + roving tabindex + Left/Right/Home/End follow the WAI-ARIA APG tabs
 * pattern - this is a plain button row, not built on a Radix primitive, so keyboard/AT support
 * has to be wired by hand rather than inherited for free.
 */
export function Tabs({ tabs, value, onChange, className }: TabsProps) {
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.value === value))

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null
    if (e.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length
    else if (e.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') nextIndex = 0
    else if (e.key === 'End') nextIndex = tabs.length - 1
    if (nextIndex === null) return

    e.preventDefault()
    onChange(tabs[nextIndex].value)
    ;(e.currentTarget.parentElement?.children[nextIndex] as HTMLElement | undefined)?.focus()
  }

  return (
    <div role="tablist" className={cn('flex items-center gap-1 border-b border-[var(--color-border)]', className)}>
      {tabs.map((tab, index) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={index === activeIndex ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              '-mb-px inline-flex h-[34px] items-center gap-1.5 border-b-2 px-3',
              'text-[13px] font-medium transition-colors duration-150',
              'focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)]',
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
