// src/modules/dashboard/components/PerformanceWidget.tsx
// PRD §10.1/§10.7 - backend-computed performance rollup (GET /dashboard/performance), never
// computed client-side. Shows completed/pending/overdue tasks, documents uploaded, and pending
// payments (all real, backend-aggregated numbers) plus a per-staff breakdown for unrestricted
// roles. Does NOT show "revenue collected" or "compliance completion" - PaymentStatus.COMPLETED
// is never set by any write path in this codebase today (see DashboardAggregationService's own
// header comment on the backend), so a revenue figure would either always read zero or have to be
// fabricated; this widget stays honest instead, same principle RevenueWidget/TrendsWidget already
// follow elsewhere in this module.
import { CheckCircle2, Clock, AlertTriangle, FileUp, Receipt } from 'lucide-react'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { StatCard, StatsGrid } from '@/components/shared/StatCard/StatCard'
import { Skeleton, ErrorState } from '@/components/feedback'
import { useDashboardPerformanceQuery } from '../hooks'

export function PerformanceWidget() {
  const { data, isLoading, isError } = useDashboardPerformanceQuery()

  if (isLoading) return <Card><CardHeader title="Performance" /><Skeleton variant="table" rows={3} height={40} /></Card>
  if (isError) return <Card><CardHeader title="Performance" /><ErrorState message="Couldn't load performance data." /></Card>

  return (
    <Card>
      <CardHeader
        title="Performance"
        action={
          data && (
            <span className="text-[11px] text-[var(--color-text-muted)]">
              {new Date(data.range.from).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} –{' '}
              {new Date(data.range.to).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
            </span>
          )
        }
      />
      <StatsGrid>
        <StatCard label="Completed Tasks" value={data?.tasks.completed ?? 0} icon={CheckCircle2} />
        <StatCard label="Pending Tasks" value={data?.tasks.pending ?? 0} icon={Clock} />
        <StatCard label="Overdue Work" value={data?.tasks.overdue ?? 0} icon={AlertTriangle} />
        <StatCard label="Documents Uploaded" value={data?.documentsUploaded ?? 0} icon={FileUp} />
        <StatCard label="Pending Payments" value={data?.pendingPayments ?? 0} icon={Receipt} />
      </StatsGrid>

      {data?.staffBreakdown && data.staffBreakdown.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                {Object.keys(data.staffBreakdown[0]).map((key) => (
                  <th key={key} className="pb-1.5 pr-3 font-medium capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.staffBreakdown.map((row, i) => (
                <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
                  {Object.values(row).map((value, j) => (
                    <td key={j} className="py-1.5 pr-3 text-[var(--color-text-body)]">
                      {String(value)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
