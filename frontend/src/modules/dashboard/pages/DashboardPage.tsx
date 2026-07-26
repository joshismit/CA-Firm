// src/modules/dashboard/pages/DashboardPage.tsx
import { PageHeader } from '@/components/shared/PageHeader/PageHeader'
import { Card } from '@/components/shared/Card/Card'
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { AlertBanner } from '@/components/feedback'
import { formatINR, formatDate, cn } from '@/lib/utils'
import {
  Users,
  FileText,
  IndianRupee,
  CheckCircle2,
  Plus,
  Upload,
  RefreshCw,
  ArrowUpRight,
  MoreHorizontal,
  Zap,
  Activity,
} from 'lucide-react'
import { KPICard, RevenueChart, GSTStatusCard, RecentTasksWidget, ChartCard } from '../components'

// ─── Mock Data ────────────────────────────────────────────────────────────────

const KPI_CARDS = [
  {
    label: 'Total Revenue',
    value: 4820000,
    isAmount: true,
    change: 12.4,
    changeLabel: 'vs last month',
    icon: IndianRupee,
    color: 'primary',
    sparkData: [32, 40, 35, 50, 49, 60, 70, 91, 85],
  },
  {
    label: 'Active Clients',
    value: 247,
    isAmount: false,
    change: 8.1,
    changeLabel: '14 new this month',
    icon: Users,
    color: 'success',
    sparkData: [180, 195, 200, 210, 218, 224, 232, 240, 247],
  },
  {
    label: 'Pending Filings',
    value: 38,
    isAmount: false,
    change: -5.2,
    changeLabel: 'from 40 last week',
    icon: FileText,
    color: 'warning',
    sparkData: [45, 42, 48, 44, 40, 43, 40, 38, 38],
  },
  {
    label: 'Tasks Completed',
    value: 124,
    isAmount: false,
    change: 22.3,
    changeLabel: 'this month',
    icon: CheckCircle2,
    color: 'info',
    sparkData: [80, 85, 90, 95, 100, 108, 115, 120, 124],
  },
]

const REVENUE_DATA = [
  { month: 'Jan', revenue: 3200000, collections: 2800000 },
  { month: 'Feb', revenue: 2900000, collections: 2600000 },
  { month: 'Mar', revenue: 4100000, collections: 3800000 },
  { month: 'Apr', revenue: 3800000, collections: 3500000 },
  { month: 'May', revenue: 4500000, collections: 4100000 },
  { month: 'Jun', revenue: 4200000, collections: 3900000 },
  { month: 'Jul', revenue: 4820000, collections: 4500000 },
]

const GST_STATUS_DATA = [
  { name: 'Filed', value: 142, color: '#10B981' },
  { name: 'Pending', value: 38, color: '#F59E0B' },
  { name: 'Overdue', value: 12, color: '#F43F5E' },
  { name: 'Draft', value: 22, color: '#6366F1' },
]

const RECENT_CLIENTS = [
  { id: 'C001', name: 'Apex Manufacturing Pvt. Ltd.', pan: 'AABCA1234B', gstin: '27AABCA1234B1Z5', status: 'active', filings: 8, lastFiling: '2025-06-30', balance: 48500 },
  { id: 'C002', name: 'Sharma & Sons Traders', pan: 'BSHPS5678C', gstin: '06BSHPS5678C2Z3', status: 'active', filings: 12, lastFiling: '2025-07-01', balance: -12000 },
  { id: 'C003', name: 'Greenleaf Pharma Ltd.', pan: 'CGPLP9012D', gstin: '29CGPLP9012D3Z1', status: 'pending', filings: 5, lastFiling: '2025-05-31', balance: 0 },
  { id: 'C004', name: 'Metro Infra Projects', pan: 'DMIPP3456E', gstin: '07DMIPP3456E4Z8', status: 'active', filings: 9, lastFiling: '2025-06-30', balance: 125000 },
  { id: 'C005', name: 'Sunrise Exports Ltd.', pan: 'ESELE7890F', gstin: '19ESELE7890F5Z2', status: 'overdue', filings: 3, lastFiling: '2025-04-30', balance: -8500 },
]

const RECENT_TASKS = [
  { id: 'T001', title: 'File GSTR-1 for Apex Manufacturing', client: 'Apex Manufacturing', due: '2025-07-20', priority: 'high', status: 'in_progress' },
  { id: 'T002', title: 'Prepare ITR for FY 2024-25 – Sharma & Sons', client: 'Sharma & Sons', due: '2025-07-31', priority: 'high', status: 'pending' },
  { id: 'T003', title: 'TDS Return Q1 – Greenleaf Pharma', client: 'Greenleaf Pharma', due: '2025-07-15', priority: 'medium', status: 'pending' },
  { id: 'T004', title: 'Reconcile Form 26AS – Metro Infra', client: 'Metro Infra', due: '2025-07-25', priority: 'low', status: 'completed' },
  { id: 'T005', title: 'Annual Compliance – Sunrise Exports', client: 'Sunrise Exports', due: '2025-07-10', priority: 'high', status: 'overdue' },
]

const UPCOMING_DEADLINES = [
  { date: '2025-07-15', event: 'GSTR-1 Filing', count: 12, severity: 'danger' },
  { date: '2025-07-20', event: 'TDS Challan Deposit', count: 8, severity: 'warning' },
  { date: '2025-07-25', event: 'GSTR-3B Filing', count: 18, severity: 'danger' },
  { date: '2025-07-31', event: 'ITR Filing Deadline', count: 35, severity: 'warning' },
  { date: '2025-08-07', event: 'TDS Return Q1', count: 24, severity: 'info' },
]

// ─── Subcomponents (not promoted - only used within this one section) ─────────

function ClientStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: 'success' | 'warning' | 'danger' | 'default'; label: string }> = {
    active: { variant: 'success', label: 'Active' },
    pending: { variant: 'warning', label: 'Pending' },
    overdue: { variant: 'danger', label: 'Overdue' },
    inactive: { variant: 'default', label: 'Inactive' },
  }
  const config = map[status] || map.inactive
  return <StatusBadge variant={config.variant} dot>{config.label}</StatusBadge>
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const today = new Date()

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Dashboard"
        description={`Good morning, Amit. Here's what's happening today — ${today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
        actions={
          <div className="flex items-center gap-2">
            <button className={cn(
              'flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-md)]',
              'text-[12px] font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)]',
              'hover:bg-[var(--color-hover)] transition-colors'
            )}>
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <button className={cn(
              'flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-md)]',
              'text-[12px] font-medium text-white bg-[var(--color-primary-600)]',
              'hover:bg-[var(--color-primary-700)] transition-colors shadow-[var(--shadow-xs)]'
            )}>
              <Plus className="w-3.5 h-3.5" />
              New Task
            </button>
          </div>
        }
      />

      {/* Alert Banner */}
      <AlertBanner
        variant="danger"
        message={
          <>
            <span className="font-semibold">Action required:</span> 12 GSTR-1 filings are due today (15 July 2025). Clients: Apex Manufacturing, Sharma & Sons, and 10 more.
          </>
        }
        action={
          <button className="text-[11px] font-semibold text-[var(--color-danger)] hover:underline shrink-0">
            View All →
          </button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {KPI_CARDS.map((card) => (
          <KPICard key={card.label} {...card} />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <RevenueChart data={REVENUE_DATA} className="lg:col-span-2" />
        <GSTStatusCard data={GST_STATUS_DATA} period="Jul 2025" />
      </div>

      {/* Bottom Row: Clients Table + Tasks + Deadlines */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Recent Clients — 2/3 */}
        <ChartCard
          title="Recent Clients"
          action={
            <a href="/clients" className="text-[12px] font-medium text-[var(--color-text-link)] hover:underline flex items-center gap-1">
              View all <ArrowUpRight className="w-3 h-3" />
            </a>
          }
          className="xl:col-span-2"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  {['Client', 'PAN', 'Status', 'Filings', 'Last Filing', 'Outstanding'].map(col => (
                    <th
                      key={col}
                      className={cn(
                        'pb-2.5 px-4 first:pl-0 last:pr-0 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] text-left',
                        col === 'Outstanding' && 'text-right',
                        col === 'Filings' && 'text-center',
                      )}
                    >
                      {col}
                    </th>
                  ))}
                  <th className="pb-2.5 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {RECENT_CLIENTS.map((client) => (
                  <tr
                    key={client.id}
                    className="group hover:bg-[var(--color-hover)] transition-colors"
                  >
                    <td className="py-3 px-4 first:pl-0">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--color-primary-400)] to-[var(--color-primary-600)] flex items-center justify-center shrink-0">
                          <span className="text-[9px] font-bold text-white">
                            {client.name.split(' ').slice(0, 2).map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-[var(--color-text-body)] truncate max-w-[160px]">
                            {client.name}
                          </p>
                          <p className="text-[10px] text-[var(--color-text-muted)] font-mono">
                            {client.gstin?.slice(0, 15)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[var(--color-text-secondary)] text-[11px] tracking-wider">
                        {client.pan}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <ClientStatusBadge status={client.status} />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-mono font-medium text-[var(--color-text-body)]">
                        {client.filings}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[var(--color-text-secondary)]">
                      {formatDate(client.lastFiling)}
                    </td>
                    <td className="py-3 px-4 last:pr-0 text-right">
                      <span className={cn(
                        'font-mono font-semibold text-[12px]',
                        client.balance > 0 ? 'text-[var(--color-success)]' :
                        client.balance < 0 ? 'text-[var(--color-danger)]' :
                        'text-[var(--color-text-muted)]'
                      )}>
                        {client.balance === 0 ? '—' : formatINR(Math.abs(client.balance), 0)}
                        {client.balance < 0 && <span className="text-[9px] ml-0.5">DR</span>}
                      </span>
                    </td>
                    <td className="py-3">
                      <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-[var(--radius-sm)] hover:bg-[var(--color-surface)] text-[var(--color-text-muted)]">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>

        {/* Right column: Tasks + Deadlines */}
        <div className="space-y-4">
          <RecentTasksWidget tasks={RECENT_TASKS} pendingCount={5} />

          {/* Upcoming Deadlines */}
          <ChartCard title="Upcoming Deadlines" action={<Activity className="w-4 h-4 text-[var(--color-text-muted)]" />}>
            <div className="space-y-2.5">
              {UPCOMING_DEADLINES.map((d) => {
                const sev = d.severity as 'danger' | 'warning' | 'info'
                const colorMap = {
                  danger: 'bg-[var(--color-danger)]',
                  warning: 'bg-[var(--color-warning)]',
                  info: 'bg-[var(--color-info)]',
                }
                return (
                  <div key={d.date} className="flex items-center gap-3">
                    <div className={cn('w-1 h-8 rounded-full shrink-0', colorMap[sev])} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-[var(--color-text-body)] leading-tight">{d.event}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">{formatDate(d.date)}</p>
                    </div>
                    <span className={cn(
                      'text-[11px] font-semibold font-mono px-1.5 py-0.5 rounded-[var(--radius-xs)]',
                      sev === 'danger' ? 'text-[var(--color-danger-fg)] bg-[var(--color-danger-bg)]' :
                      sev === 'warning' ? 'text-[var(--color-warning-fg)] bg-[var(--color-warning-bg)]' :
                      'text-[var(--color-info-fg)] bg-[var(--color-info-bg)]'
                    )}>
                      {d.count}
                    </span>
                  </div>
                )
              })}
            </div>
          </ChartCard>
        </div>
      </div>

      {/* Quick Actions Footer */}
      <Card padding="sm">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-[var(--color-warning)]" />
          <h3 className="text-[13px] font-semibold text-[var(--color-text-heading)]">Quick Actions</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Add Client', icon: Users, color: 'primary' },
            { label: 'New Invoice', icon: FileText, color: 'success' },
            { label: 'Upload Documents', icon: Upload, color: 'info' },
            { label: 'File GST Return', icon: CheckCircle2, color: 'warning' },
          ].map(({ label, icon: Icon, color }) => {
            const btnColors: Record<string, string> = {
              primary: 'hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary-700)] hover:border-[var(--color-primary-200)]',
              success: 'hover:bg-[var(--color-success-bg)] hover:text-[var(--color-success-fg)] hover:border-[var(--color-success-border)]',
              info: 'hover:bg-[var(--color-info-bg)] hover:text-[var(--color-info-fg)] hover:border-[var(--color-info-border)]',
              warning: 'hover:bg-[var(--color-warning-bg)] hover:text-[var(--color-warning-fg)] hover:border-[var(--color-warning-border)]',
            }
            const iconColors: Record<string, string> = {
              primary: 'var(--color-primary-600)',
              success: 'var(--color-success)',
              info: 'var(--color-info)',
              warning: 'var(--color-warning)',
            }
            return (
              <button
                key={label}
                className={cn(
                  'flex items-center gap-2.5 p-3 rounded-[var(--radius-md)]',
                  'border border-[var(--color-border)] text-[var(--color-text-secondary)]',
                  'text-[12px] font-medium transition-all duration-150',
                  btnColors[color]
                )}
              >
                <Icon className="w-4 h-4 shrink-0" style={{ color: iconColors[color] }} />
                {label}
              </button>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
