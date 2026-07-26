// src/components/charts/LineChart.tsx
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartContainer } from './ChartContainer'
import { ChartTooltip } from './ChartTooltip'
import type { ChartSeries } from './AreaChart'

export interface LineChartProps {
  // `any` (not `unknown`) is intentional - see AreaChartProps.
  data: Record<string, any>[]
  series: ChartSeries[]
  xKey: string
  height?: number
  yTickFormatter?: (value: number) => string
  tooltipValueFormatter?: (value: number) => string
}

export function LineChart({ data, series, xKey, height = 200, yTickFormatter, tooltipValueFormatter }: LineChartProps) {
  return (
    <ChartContainer height={height}>
      <RechartsLineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} tickFormatter={yTickFormatter} />
        <Tooltip content={<ChartTooltip valueFormatter={tooltipValueFormatter} />} />
        {series.map((s) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={false} />
        ))}
      </RechartsLineChart>
    </ChartContainer>
  )
}
