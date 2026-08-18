// src/modules/reports/pages/ReportsListPage.tsx
// "Reports dashboard" + "Report list" combined: a categorized grid of the 8 real, already-
// established report types (constants/index.ts), not a paginated DataTable - there are only 8
// fixed entries and nothing about them is server-fetched, so DataTable's
// pagination/sorting/row-selection/bulk-actions/column-visibility machinery has nothing to operate
// on. Search and category filtering are still real and functional, just applied client-side over
// this small static catalog instead of forced through DataTable. Stats cards here are genuine,
// static facts about the catalog itself (counts per category) - not fetched or fabricated.
import { useMemo, useState } from 'react'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { StatCard, StatsGrid } from '@/components/shared/StatCard/StatCard'
import { EmptyState } from '@/components/feedback'
import { Search as SearchIcon, FileBarChart } from 'lucide-react'
import { ReportTypeCard } from '../components'
import { REPORT_CATEGORY_LABELS, REPORT_TYPE_CATEGORY, REPORT_TYPE_LABELS } from '../constants'
import type { ReportType } from '../types'

const REPORT_TYPES = Object.keys(REPORT_TYPE_LABELS) as ReportType[]

const CATEGORY_FILTER_OPTIONS = [
  { value: '__all__', label: 'All categories' },
  ...Object.entries(REPORT_CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
]

export function ReportsListPage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<keyof typeof REPORT_CATEGORY_LABELS | '__all__'>('__all__')

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { CLIENT: 0, FINANCIAL: 0, OPERATIONAL: 0 }
    for (const type of REPORT_TYPES) counts[REPORT_TYPE_CATEGORY[type]]++
    return counts
  }, [])

  const filtered = REPORT_TYPES.filter((type) => {
    const matchesCategory = category === '__all__' || REPORT_TYPE_CATEGORY[type] === category
    const matchesSearch = !search || REPORT_TYPE_LABELS[type].toLowerCase().includes(search.toLowerCase())
    return matchesCategory && matchesSearch
  })

  return (
    <PageLayout>
      <PageHeader title="Reports" description="Generate and export reports across clients, finances, and operations." />

      <PageContent>
        <div className="space-y-4">
          <StatsGrid>
            <StatCard label="Report Types" value={REPORT_TYPES.length} icon={FileBarChart} />
            <StatCard label="Client Reports" value={categoryCounts.CLIENT} />
            <StatCard label="Financial Reports" value={categoryCounts.FINANCIAL} />
            <StatCard label="Operational Reports" value={categoryCounts.OPERATIONAL} />
          </StatsGrid>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search reports…"
                className="pl-9"
                aria-label="Search reports"
              />
            </div>
            <Select
              value={category}
              onChange={(v) => setCategory(v as typeof category)}
              options={CATEGORY_FILTER_OPTIONS}
              className="h-10 w-full sm:w-[200px]"
              placeholder="Category"
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={FileBarChart} title="No reports match" description="Try a different search term or category." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((type) => (
                <ReportTypeCard key={type} type={type} label={REPORT_TYPE_LABELS[type]} category={REPORT_TYPE_CATEGORY[type]} />
              ))}
            </div>
          )}
        </div>
      </PageContent>
    </PageLayout>
  )
}
