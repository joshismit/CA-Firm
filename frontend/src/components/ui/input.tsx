// src/components/ui/input.tsx
import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Leading icon, e.g. <Hash size={14} /> or <Search size={14} /> */
  icon?: React.ReactNode
  /** Marks the field as invalid — red border/ring instead of the default focus state. */
  invalid?: boolean
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, invalid = false, ...props }, ref) => {
    const inputClass = cn(
      'h-10 w-full rounded-[var(--radius-md)] border bg-[var(--color-card)] px-3',
      icon && 'pl-9',
      'text-[13px] text-[var(--color-text-body)] placeholder:text-[var(--color-text-disabled)]',
      'outline-none transition-colors',
      invalid
        ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-2 focus:ring-[var(--color-danger)]/20'
        : 'border-[var(--color-border)] focus:border-[var(--color-primary-600)] focus:ring-2 focus:ring-[var(--color-primary-600)]/15',
      'disabled:cursor-not-allowed disabled:bg-[var(--color-surface)] disabled:text-[var(--color-text-disabled)]',
      className
    )

    if (!icon) {
      return <input ref={ref} className={inputClass} {...props} />
    }

    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
          {icon}
        </span>
        <input ref={ref} className={inputClass} {...props} />
      </div>
    )
  }
)
Input.displayName = 'Input'
