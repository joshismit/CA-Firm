// src/modules/dashboard/components/RevenueChart.tsx
// Extracted from DashboardPage's "Revenue vs Collections" card - same data shape/visual output.
import { AreaChart } from '@/components/charts/AreaChart'
import { ChartLegend } from '@/components/charts/ChartLegend'
import { ChartCard } from './ChartCard'

export interface RevenueDatum {
  month: string
  revenue: number
  collections: number
}

export interface RevenueChartProps {
  data: RevenueDatum[]
  className?: string
}

export function RevenueChart({ data, className }: RevenueChartProps) {
  return (
    <ChartCard
      title="Revenue vs Collections"
      action={
        <ChartLegend
          items={[
            { label: 'Revenue', color: 'var(--color-primary-500)' },
            { label: 'Collections', color: 'var(--color-success)' },
          ]}
        />
      }
      className={className}
    >
      <AreaChart
        data={data}
        xKey="month"
        series={[
          { key: 'revenue', name: 'Revenue', color: '#6366F1' },
          { key: 'collections', name: 'Collections', color: '#10B981' },
        ]}
        height={200}
        yTickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`}
      />
    </ChartCard>
  )
}
