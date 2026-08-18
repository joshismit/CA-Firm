// src/components/charts/PieChart.tsx
import { Cell, Pie, PieChart as RechartsPieChart, Tooltip } from 'recharts'
import { ChartContainer } from './ChartContainer'
import { ChartTooltip } from './ChartTooltip'
import { ChartLegend } from './ChartLegend'

export interface PieChartDatum {
  name: string
  value: number
  color: string
}

export interface PieChartProps {
  data: PieChartDatum[]
  height?: number
  innerRadius?: number
  outerRadius?: number
  showLegend?: boolean
  valueFormatter?: (value: number) => string
}

export function PieChart({
  data,
  height = 200,
  innerRadius = 0,
  outerRadius = 80,
  showLegend = true,
  valueFormatter,
}: PieChartProps) {
  return (
    <div className="space-y-3">
      <ChartContainer height={height}>
        <RechartsPieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={innerRadius} outerRadius={outerRadius}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} />
        </RechartsPieChart>
      </ChartContainer>
      {showLegend && <ChartLegend items={data.map((d) => ({ label: d.name, color: d.color }))} />}
    </div>
  )
}
