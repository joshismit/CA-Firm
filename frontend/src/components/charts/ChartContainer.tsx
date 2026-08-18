// src/components/charts/ChartContainer.tsx
// Shared Recharts <ResponsiveContainer> chrome - every wrapper below renders through this so
// sizing stays consistent without each chart re-declaring width/height.
import type { ReactElement } from 'react'
import { ResponsiveContainer } from 'recharts'

export interface ChartContainerProps {
  height?: number
  width?: number | `${number}%`
  children: ReactElement
}

export function ChartContainer({ height = 240, width = '100%', children }: ChartContainerProps) {
  return (
    <ResponsiveContainer width={width} height={height}>
      {children}
    </ResponsiveContainer>
  )
}
