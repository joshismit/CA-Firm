// src/modules/dashboard/components/GSTStatusCard.tsx
// Extracted from DashboardPage's "GST Filing Status" card - same Progress rows + mini bar chart.
import { Progress } from '@/components/ui/progress'
import { BarChart } from '@/components/charts/BarChart'
import { ChartCard } from './ChartCard'

export interface GSTStatusDatum {
  name: string
  value: number
  color: string
}

export interface GSTStatusCardProps {
  data: GSTStatusDatum[]
  period?: string
}

export function GSTStatusCard({ data, period }: GSTStatusCardProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <ChartCard
      title="GST Filing Status"
      action={period && <span className="text-[11px] text-[var(--color-text-muted)]">{period}</span>}
    >
      <div className="space-y-3">
        {data.map((item) => {
          const pct = Math.round((item.value / total) * 100)
          return (
            <div key={item.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="flex items-center gap-2 text-[12px] text-[var(--color-text-secondary)]">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.name}
                </span>
                <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--color-text-heading)]">
                  <span className="font-mono">{item.value}</span>
                  <span className="text-[10px] font-normal text-[var(--color-text-muted)] bg-[var(--color-surface)] px-1 py-0.5 rounded-[var(--radius-xs)]">
                    {pct}%
                  </span>
                </div>
              </div>
              <Progress value={pct} color={item.color} height={6} />
            </div>
          )
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
        <BarChart
          data={data}
          dataKey="value"
          xKey="name"
          colorKey="color"
          height={100}
          tooltipFormatter={(value) => [value, 'Clients']}
        />
      </div>
    </ChartCard>
  )
}
