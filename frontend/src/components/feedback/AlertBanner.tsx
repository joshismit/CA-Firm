// src/components/feedback/AlertBanner.tsx
// Extracted from DashboardPage's hand-rolled "Action required" banner - same markup, generalized
// with a variant so any module can reuse it instead of hand-rolling its own.
import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

type AlertVariant = 'danger' | 'warning' | 'info' | 'success'

const VARIANT_CLASS: Record<AlertVariant, string> = {
  danger: 'border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger-fg)]',
  warning: 'border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning-fg)]',
  info: 'border-[var(--color-info-border)] bg-[var(--color-info-bg)] text-[var(--color-info-fg)]',
  success: 'border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success-fg)]',
}

const ICON_MAP: Record<AlertVariant, typeof AlertCircle> = {
  danger: AlertCircle,
  warning: AlertCircle,
  info: Info,
  success: CheckCircle2,
}

const ICON_COLOR_CLASS: Record<AlertVariant, string> = {
  danger: 'text-[var(--color-danger)]',
  warning: 'text-[var(--color-warning)]',
  info: 'text-[var(--color-info)]',
  success: 'text-[var(--color-success)]',
}

export interface AlertBannerProps {
  variant?: AlertVariant
  message: ReactNode
  action?: ReactNode
  className?: string
}

export function AlertBanner({ variant = 'info', message, action, className }: AlertBannerProps) {
  const Icon = ICON_MAP[variant]

  return (
    <div className={cn('flex items-center gap-3 p-3.5 rounded-[var(--radius-md)] border', VARIANT_CLASS[variant], className)}>
      <Icon className={cn('w-4 h-4 shrink-0', ICON_COLOR_CLASS[variant])} />
      <p className="text-[12px]">{message}</p>
      {action && <div className="ml-auto shrink-0">{action}</div>}
    </div>
  )
}
