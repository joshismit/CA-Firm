// src/modules/dashboard/components/ChartCard.tsx
// Card + header composite for wrapping chart content. Uses the real components/shared/Card for the
// container (its default padding="md" is pixel-identical to the old local Card), but keeps the
// header row's original 14px title markup rather than components/shared/Card's CardHeader (which
// is 15px) - swapping that in would be a 1px visual change, and this pass must stay pixel-perfect.
import type { ReactNode } from 'react'
import { Card } from '@/components/shared/Card/Card'

export interface ChartCardProps {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}

export function ChartCard({ title, action, children, className }: ChartCardProps) {
  return (
    <Card className={className}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-semibold text-[var(--color-text-heading)]">{title}</h3>
        {action}
      </div>
      {children}
    </Card>
  )
}
