// src/components/charts/ChartLegend.tsx
// Extracted from the small dot+label legend row used above the Revenue chart.
import { cn } from '@/lib/utils'

export interface ChartLegendItem {
  label: string
  color: string
}

export interface ChartLegendProps {
  items: ChartLegendItem[]
  className?: string
}

export function ChartLegend({ items, className }: ChartLegendProps) {
  return (
    <div className={cn('flex items-center gap-3 text-[11px] text-[var(--color-text-muted)]', className)}>
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  )
}
