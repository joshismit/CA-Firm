// src/modules/dashboard/components/StatisticsCard.tsx
// Simpler sibling of KPICard - icon + label + value + optional trend, no sparkline. Useful for
// future modules that want a stat display without the richer KPICard treatment.
import type { ElementType, ReactNode } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { Card } from '@/components/shared/Card/Card'
import { cn } from '@/lib/utils'

export interface StatisticsCardProps {
  label: string
  value: ReactNode
  icon?: ElementType
  change?: number
  changeLabel?: string
  color?: 'primary' | 'success' | 'warning' | 'info'
  className?: string
}

const COLOR_MAP: Record<string, { bg: string; icon: string }> = {
  primary: { bg: 'var(--color-primary-50)', icon: 'var(--color-primary-600)' },
  success: { bg: 'var(--color-success-bg)', icon: 'var(--color-success)' },
  warning: { bg: 'var(--color-warning-bg)', icon: 'var(--color-warning)' },
  info: { bg: 'var(--color-info-bg)', icon: 'var(--color-info)' },
}

export function StatisticsCard({ label, value, icon: Icon, change, changeLabel, color = 'primary', className }: StatisticsCardProps) {
  const colors = COLOR_MAP[color] ?? COLOR_MAP.primary
  const isPositive = (change ?? 0) >= 0

  return (
    <Card className={className}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium text-[var(--color-text-muted)] mb-1 uppercase tracking-wider">{label}</p>
          <p className="text-[22px] font-bold text-[var(--color-text-heading)] leading-none">{value}</p>
          {change != null && (
            <div className="flex items-center gap-1.5 mt-2">
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 text-[11px] font-semibold',
                  isPositive ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
                )}
              >
                {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {isPositive ? '+' : ''}
                {change}%
              </span>
              {changeLabel && <span className="text-[11px] text-[var(--color-text-muted)]">{changeLabel}</span>}
            </div>
          )}
        </div>
        {Icon && (
          <div className="flex items-center justify-center w-9 h-9 rounded-[var(--radius-md)] shrink-0" style={{ backgroundColor: colors.bg }}>
            <Icon className="w-[18px] h-[18px]" style={{ color: colors.icon }} />
          </div>
        )}
      </div>
    </Card>
  )
}
