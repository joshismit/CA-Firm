// src/components/shared/PageHeader/PageHeader.tsx
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 mb-6', className)}>
      <div className="min-w-0">
        <h2 className="text-[22px] font-semibold text-[var(--color-text-heading)] leading-tight tracking-tight truncate">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}
