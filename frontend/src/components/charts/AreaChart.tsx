// src/components/charts/AreaChart.tsx
// Wraps Recharts' AreaChart with the exact gradient/axis/grid config used by the Dashboard's
// Revenue vs Collections chart - pages should never import Recharts directly.
import {
  Area,
  AreaChart as RechartsAreaChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartContainer } from './ChartContainer'
import { ChartTooltip } from './ChartTooltip'

export interface ChartSeries {
  key: string
  name: string
  color: string
}

export interface AreaChartProps {
  // `any` (not `unknown`) is intentional here - concrete data-row interfaces without an explicit
  // index signature (e.g. RevenueDatum) can only satisfy an index-signature prop type via `any`.
  data: Record<string, any>[]
  series: ChartSeries[]
  xKey: string
  height?: number
  yTickFormatter?: (value: number) => string
  tooltipValueFormatter?: (value: number) => string
}

export function AreaChart({ data, series, xKey, height = 200, yTickFormatter, tooltipValueFormatter }: AreaChartProps) {
  return (
    <ChartContainer height={height}>
      <RechartsAreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`area-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={s.color} stopOpacity={0.15} />
              <stop offset="95%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} tickFormatter={yTickFormatter} />
        <Tooltip content={<ChartTooltip valueFormatter={tooltipValueFormatter} />} />
        {series.map((s) => (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} fill={`url(#area-${s.key})`} />
        ))}
      </RechartsAreaChart>
    </ChartContainer>
  )
}
