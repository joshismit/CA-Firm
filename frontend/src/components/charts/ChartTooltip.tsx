// src/components/charts/ChartTooltip.tsx
// Extracted verbatim from DashboardPage's original CustomTooltip, generalized with a value formatter.
import { formatINR } from '@/lib/utils'

export interface ChartTooltipPayloadEntry {
  value: number
  name: string
  color: string
}

export interface ChartTooltipProps {
  active?: boolean
  payload?: ChartTooltipPayloadEntry[]
  label?: string
  valueFormatter?: (value: number) => string
}

export function ChartTooltip({ active, payload, label, valueFormatter = (v) => formatINR(v, 0) }: ChartTooltipProps) {
  if (!active || !payload || !payload.length) return null

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-lg)] p-3 text-[12px]">
      <p className="font-semibold text-[var(--color-text-heading)] mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-[var(--color-text-secondary)]">
          <span style={{ color: entry.color }}>●</span>{' '}
          {entry.name}: <span className="font-mono font-medium text-[var(--color-text-body)]">{valueFormatter(entry.value)}</span>
        </p>
      ))}
    </div>
  )
}
