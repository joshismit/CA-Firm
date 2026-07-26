// src/modules/dashboard/components/KPICard.tsx
// Extracted verbatim from DashboardPage's local KpiCard function - same visual output, now reusable.
import type { ElementType } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { formatCompactINR, cn } from '@/lib/utils'

export interface KPICardProps {
  label: string
  value: number
  isAmount: boolean
  change: number
  changeLabel: string
  icon: ElementType
  color: string
  sparkData: number[]
}

const COLOR_MAP: Record<string, { bg: string; icon: string; text: string }> = {
  primary: { bg: 'var(--color-primary-50)', icon: 'var(--color-primary-600)', text: 'var(--color-primary-700)' },
  success: { bg: 'var(--color-success-bg)', icon: 'var(--color-success)', text: 'var(--color-success-fg)' },
  warning: { bg: 'var(--color-warning-bg)', icon: 'var(--color-warning)', text: 'var(--color-warning-fg)' },
  info: { bg: 'var(--color-info-bg)', icon: 'var(--color-info)', text: 'var(--color-info-fg)' },
}

export function KPICard({ label, value, isAmount, change, changeLabel, icon: Icon, color, sparkData }: KPICardProps) {
  const isPositive = change >= 0
  const colors = COLOR_MAP[color] || COLOR_MAP.primary

  const sparkMin = Math.min(...sparkData)
  const sparkMax = Math.max(...sparkData)
  const normalize = (v: number) => ((v - sparkMin) / (sparkMax - sparkMin || 1)) * 28

  return (
    <div
      className={cn(
        'relative rounded-[var(--radius-lg)] border border-[var(--color-border)]',
        'bg-[var(--color-card)] p-5 shadow-[var(--shadow-sm)]',
        'hover:shadow-[var(--shadow-md)] transition-shadow duration-200 overflow-hidden'
      )}
    >
      {/* Background accent */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{ background: `radial-gradient(circle at top right, ${colors.icon}, transparent 70%)` }}
      />

      <div className="relative">
        {/* Top row */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center justify-center w-9 h-9 rounded-[var(--radius-md)]" style={{ backgroundColor: colors.bg }}>
            <Icon className="w-4.5 h-4.5" style={{ color: colors.icon, width: '18px', height: '18px' }} />
          </div>

          {/* Sparkline */}
          <svg width="64" height="28" viewBox="0 0 64 28" className="opacity-60">
            <polyline
              points={sparkData.map((v, i) => `${(i / (sparkData.length - 1)) * 64},${28 - normalize(v)}`).join(' ')}
              fill="none"
              stroke={colors.icon}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Value */}
        <div className="mb-1">
          <p className="text-[11px] font-medium text-[var(--color-text-muted)] mb-1 uppercase tracking-wider">{label}</p>
          <p
            className={cn(
              'text-[28px] font-700 text-[var(--color-text-heading)] leading-none font-bold',
              isAmount && 'font-mono tabular-nums'
            )}
          >
            {isAmount ? formatCompactINR(value) : value.toLocaleString('en-IN')}
          </p>
        </div>

        {/* Change */}
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
          <span className="text-[11px] text-[var(--color-text-muted)]">{changeLabel}</span>
        </div>
      </div>
    </div>
  )
}
