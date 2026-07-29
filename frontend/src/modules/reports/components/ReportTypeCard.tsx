// src/modules/reports/components/ReportTypeCard.tsx
// One tile per report type in the Reports dashboard grid - navigates to the generate/detail page
// for that type. Purely presentational, no data fetching (the catalog of 8 types is a real,
// static, already-established constant, not fetched or fabricated data).
import { Link } from 'react-router-dom'
import { ArrowRight, Users, Wallet, ClipboardList } from 'lucide-react'
import { Card } from '@/components/shared/Card/Card'
import { REPORT_CATEGORY_LABELS, REPORT_TYPE_DESCRIPTIONS } from '../constants'
import type { ReportType } from '../types'

const CATEGORY_ICON = {
  CLIENT: Users,
  FINANCIAL: Wallet,
  OPERATIONAL: ClipboardList,
} as const

export interface ReportTypeCardProps {
  type: ReportType
  label: string
  category: keyof typeof REPORT_CATEGORY_LABELS
}

export function ReportTypeCard({ type, label, category }: ReportTypeCardProps) {
  const Icon = CATEGORY_ICON[category]

  return (
    <Link to={`/reports/${type}`} className="block h-full">
      <Card className="h-full flex flex-col hover:border-[var(--color-primary-300)] hover:shadow-[var(--shadow-md)] transition-all">
        <div className="flex items-start justify-between gap-3">
          <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-primary-50)] flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-[var(--color-primary-600)]" />
          </div>
          <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
            {REPORT_CATEGORY_LABELS[category]}
          </span>
        </div>
        <h3 className="mt-3 text-[14px] font-semibold text-[var(--color-text-heading)]">{label}</h3>
        <p className="mt-1 text-[12px] text-[var(--color-text-muted)] flex-1">{REPORT_TYPE_DESCRIPTIONS[type]}</p>
        <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--color-primary-600)]">
          Generate <ArrowRight className="w-3 h-3" />
        </span>
      </Card>
    </Link>
  )
}
