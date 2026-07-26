// src/modules/clients/pages/ClientsPage.tsx
import { useState } from 'react'
import { Plus, Download } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader/PageHeader'
import { Tabs } from '@/components/shared/Tabs/Tabs'
import { Card } from '@/components/shared/Card/Card'
import { Separator } from '@/components/shared/Separator/Separator'
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { Avatar } from '@/components/ui/avatar'
import { formatINR, formatDate, cn } from '@/lib/utils'

type ClientStatus = 'active' | 'pending' | 'overdue' | 'inactive'
type TabValue = 'all' | 'active' | 'overdue' | 'archived'

interface ClientRow {
  id: string
  name: string
  pan: string
  gstin: string
  status: ClientStatus
  filings: number
  lastFiling: string
  balance: number
}

const CLIENTS: ClientRow[] = [
  { id: 'C001', name: 'Apex Manufacturing Pvt. Ltd.', pan: 'AABCA1234B', gstin: '27AABCA1234B1Z5', status: 'active', filings: 8, lastFiling: '2025-06-30', balance: 48500 },
  { id: 'C002', name: 'Sharma & Sons Traders', pan: 'BSHPS5678C', gstin: '06BSHPS5678C2Z3', status: 'active', filings: 12, lastFiling: '2025-07-01', balance: -12000 },
  { id: 'C003', name: 'Greenleaf Pharma Ltd.', pan: 'CGPLP9012D', gstin: '29CGPLP9012D3Z1', status: 'pending', filings: 5, lastFiling: '2025-05-31', balance: 0 },
  { id: 'C004', name: 'Metro Infra Projects', pan: 'DMIPP3456E', gstin: '07DMIPP3456E4Z8', status: 'active', filings: 9, lastFiling: '2025-06-30', balance: 125000 },
  { id: 'C005', name: 'Sunrise Exports Ltd.', pan: 'ESELE7890F', gstin: '19ESELE7890F5Z2', status: 'overdue', filings: 3, lastFiling: '2025-04-30', balance: -8500 },
]

const STATUS_CONFIG: Record<ClientStatus, { variant: 'success' | 'warning' | 'danger' | 'default'; label: string }> = {
  active: { variant: 'success', label: 'Active' },
  pending: { variant: 'warning', label: 'Pending' },
  overdue: { variant: 'danger', label: 'Overdue' },
  inactive: { variant: 'default', label: 'Inactive' },
}

const secondaryBtn = cn(
  'flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-md)]',
  'text-[12px] font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)]',
  'hover:bg-[var(--color-hover)] transition-colors'
)

const primaryBtn = cn(
  'flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-md)]',
  'text-[12px] font-medium text-white bg-[var(--color-primary-600)]',
  'hover:bg-[var(--color-primary-700)] transition-colors shadow-[var(--shadow-xs)]'
)

export function ClientsPage() {
  const [tab, setTab] = useState<TabValue>('active')

  const totalCount = CLIENTS.length
  const overdueCount = CLIENTS.filter((c) => c.status === 'overdue').length

  const filtered = CLIENTS.filter((c) => {
    if (tab === 'all') return true
    if (tab === 'archived') return c.status === 'inactive'
    return c.status === tab
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description={`${totalCount} active · ${overdueCount} overdue filings`}
        actions={
          <>
            <button className={secondaryBtn}>
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
            <button className={primaryBtn}>
              <Plus className="w-3.5 h-3.5" />
              Add Client
            </button>
          </>
        }
      />

      <Tabs
        value={tab}
        onChange={(v) => setTab(v as TabValue)}
        tabs={[
          { value: 'all', label: 'All', badge: totalCount },
          { value: 'active', label: 'Active' },
          { value: 'overdue', label: 'Overdue', badge: overdueCount },
          { value: 'archived', label: 'Archived' },
        ]}
      />

      <div className="space-y-3">
        {filtered.map((client) => {
          const status = STATUS_CONFIG[client.status]
          return (
            <Card key={client.id}>
              <div className="flex items-start justify-between gap-4">
                <h4 className="text-[15px] font-semibold text-[var(--color-text-heading)]">{client.name}</h4>
                <StatusBadge variant={status.variant} dot>
                  {status.label}
                </StatusBadge>
              </div>

              <div className="mt-3 flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={client.name} size="md" />
                  <div className="min-w-0 text-[12px]">
                    <p className="text-[var(--color-text-secondary)]">
                      <span className="text-[var(--color-text-muted)]">PAN</span> {client.pan}
                    </p>
                    <p className="mt-0.5 text-[var(--color-text-muted)]">
                      {client.filings} filings · Last GSTR-1 filed {formatDate(client.lastFiling)}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                    Outstanding
                  </p>
                  <p className="mt-0.5 font-mono text-[16px] font-bold tabular-nums text-[var(--color-text-heading)]">
                    {client.balance === 0 ? '—' : formatINR(Math.abs(client.balance), 0)}
                  </p>
                </div>
              </div>

              <Separator className="my-3.5" />

              <div className="flex items-center gap-2">
                <button className="h-7 rounded-[var(--radius-sm)] bg-[var(--color-surface)] px-2.5 text-[12px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)]">
                  View profile
                </button>
                <button className="h-7 rounded-[var(--radius-sm)] px-2.5 text-[12px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)]">
                  Documents
                </button>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
