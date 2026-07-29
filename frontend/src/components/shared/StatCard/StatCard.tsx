// src/components/shared/StatCard/StatCard.tsx
// Generic statistic tile - icon, label, value, optional loading/error state. Built on the existing
// Card primitive (not a new surface). Reusable across every module's list-page header row instead
// of a per-module duplicate. Renders a Skeleton while `isLoading`, and a muted dash on error rather
// than a fabricated number.
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card } from '@/components/shared/Card/Card'
import { Skeleton } from '@/components/feedback'
import { cn } from '@/lib/utils'

export interface StatCardProps {
  label: string
  value: string | number
  icon?: LucideIcon
  isLoading?: boolean
  isError?: boolean
  hint?: string
  className?: string
}

export function StatCard({ label, value, icon: Icon, isLoading, isError, hint, className }: StatCardProps) {
  return (
    <Card padding="sm" className={cn('flex items-center gap-3', className)}>
      {Icon && (
        <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-primary-50)] flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-[var(--color-primary-600)]" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] truncate">{label}</p>
        {isLoading ? (
          <Skeleton width={48} height={20} className="mt-1" />
        ) : (
          <p className="text-[20px] font-semibold text-[var(--color-text-heading)] leading-tight tabular-nums">
            {isError ? '—' : value}
          </p>
        )}
        {hint && !isLoading && <p className="text-[11px] text-[var(--color-text-muted)] truncate">{hint}</p>}
      </div>
    </Card>
  )
}

export interface StatsGridProps {
  children: ReactNode
  className?: string
}

/** Responsive grid for a row of StatCards - 1 col at 390px, 2 at 768px, 4 at 1024px+. */
export function StatsGrid({ children, className }: StatsGridProps) {
  return <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3', className)}>{children}</div>
}
