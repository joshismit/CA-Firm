// src/components/feedback/EmptyState.tsx
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-12 px-6', className)}>
      {Icon && (
        <div className="w-14 h-14 rounded-[var(--radius-xl)] bg-[var(--color-surface)] flex items-center justify-center mb-4">
          <Icon className="w-6 h-6 text-[var(--color-text-muted)]" />
        </div>
      )}
      <h3 className="text-[15px] font-semibold text-[var(--color-text-heading)]">{title}</h3>
      {description && (
        <p className="mt-1 text-[13px] text-[var(--color-text-muted)] max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
