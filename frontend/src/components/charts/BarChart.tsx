// src/components/charts/BarChart.tsx
// Matches the Dashboard's GST-status mini bar chart config (per-datum Cell colors via colorKey).
import { Bar, BarChart as RechartsBarChart, Cell, Tooltip, XAxis } from 'recharts'
import { ChartContainer } from './ChartContainer'

export interface BarChartProps {
  // `any` (not `unknown`) is intentional - see AreaChartProps.
  data: Record<string, any>[]
  dataKey: string
  xKey: string
  height?: number
  /** Field on each datum to read a per-bar color from (e.g. "color"). Overrides `color`. */
  colorKey?: string
  color?: string
  tooltipFormatter?: (value: number) => [string | number, string]
}

export function BarChart({
  data,
  dataKey,
  xKey,
  height = 100,
  colorKey,
  color = 'var(--color-primary-600)',
  tooltipFormatter,
}: BarChartProps) {
  return (
    <ChartContainer height={height}>
      <RechartsBarChart data={data} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
        <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={tooltipFormatter ? (value) => tooltipFormatter(Number(value)) : undefined}
          contentStyle={{
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            fontSize: '12px',
          }}
        />
        <Bar dataKey={dataKey} radius={[3, 3, 0, 0]} fill={colorKey ? undefined : color}>
          {colorKey && data.map((entry, i) => <Cell key={i} fill={String(entry[colorKey])} />)}
        </Bar>
      </RechartsBarChart>
    </ChartContainer>
  )
}
