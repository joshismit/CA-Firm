// src/components/shared/StatusBadge/StatusBadge.tsx
import { cn } from '@/lib/utils'

type StatusVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'

interface StatusBadgeProps {
  variant?: StatusVariant
  children: React.ReactNode
  dot?: boolean
  className?: string
}

const variantStyles: Record<StatusVariant, string> = {
  default: 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)]',
  primary: 'bg-[var(--color-primary-50)] text-[var(--color-primary-700)] border-[var(--color-primary-200)]',
  success: 'bg-[var(--color-success-bg)] text-[var(--color-success-fg)] border-[var(--color-success-border)]',
  warning: 'bg-[var(--color-warning-bg)] text-[var(--color-warning-fg)] border-[var(--color-warning-border)]',
  danger:  'bg-[var(--color-danger-bg)] text-[var(--color-danger-fg)] border-[var(--color-danger-border)]',
  info:    'bg-[var(--color-info-bg)] text-[var(--color-info-fg)] border-[var(--color-info-border)]',
}

const dotColors: Record<StatusVariant, string> = {
  default: 'bg-[var(--color-text-muted)]',
  primary: 'bg-[var(--color-primary-600)]',
  success: 'bg-[var(--color-success)]',
  warning: 'bg-[var(--color-warning)]',
  danger:  'bg-[var(--color-danger)]',
  info:    'bg-[var(--color-info)]',
}

export function StatusBadge({ variant = 'default', children, dot = false, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5',
        'text-[11px] font-medium rounded-[var(--radius-xs)] border',
        'leading-none whitespace-nowrap',
        variantStyles[variant],
        className
      )}
    >
      {dot && (
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColors[variant])} />
      )}
      {children}
    </span>
  )
}
