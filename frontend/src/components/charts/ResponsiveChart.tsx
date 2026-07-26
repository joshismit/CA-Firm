// src/components/charts/ResponsiveChart.tsx
// Config-driven dispatcher for pages that pick a chart type dynamically (e.g. a widget whose
// chart type comes from a saved dashboard-layout config) instead of importing a specific wrapper.
import { AreaChart, type AreaChartProps } from './AreaChart'
import { LineChart, type LineChartProps } from './LineChart'
import { BarChart, type BarChartProps } from './BarChart'
import { PieChart, type PieChartProps } from './PieChart'

export type ResponsiveChartProps =
  | ({ type: 'area' } & AreaChartProps)
  | ({ type: 'line' } & LineChartProps)
  | ({ type: 'bar' } & BarChartProps)
  | ({ type: 'pie' } & PieChartProps)

export function ResponsiveChart(props: ResponsiveChartProps) {
  // Narrowing `props.type` before destructuring (rather than destructuring first) is required for
  // TS to keep the discriminated union intact per-branch - destructuring a union up front widens it.
  if (props.type === 'area') {
    const { type: _type, ...rest } = props
    return <AreaChart {...rest} />
  }
  if (props.type === 'line') {
    const { type: _type, ...rest } = props
    return <LineChart {...rest} />
  }
  if (props.type === 'bar') {
    const { type: _type, ...rest } = props
    return <BarChart {...rest} />
  }
  const { type: _type, ...rest } = props
  return <PieChart {...rest} />
}
