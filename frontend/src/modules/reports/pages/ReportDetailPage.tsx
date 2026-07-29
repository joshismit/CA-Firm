// src/modules/reports/pages/ReportDetailPage.tsx
// Combines "Report detail" + "Generate report page" + "Export page": a real filters form, a real
// on-demand query (only fires once the user clicks Generate), and real export actions - all of
// which genuinely call the (currently-stubbed) reports API. Nothing is fetched on page load and
// nothing is fabricated if/when the call fails, which it always does today.
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download, FileBarChart } from 'lucide-react'
import { PageLayout, PageHeader, PageContent, PageActions } from '@/components/page'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { Button } from '@/components/ui/button'
import { Can } from '@/components/common/Can'
import { Spinner, ErrorState, EmptyState } from '@/components/feedback'
import { PERMISSIONS } from '@/config/permissions.config'
import { normalizeApiError } from '@/services/api-error'
import { useReportQuery, useExportReportMutation } from '../hooks'
import { ReportFiltersForm } from '../components'
import { REPORT_CATEGORY_LABELS, REPORT_TYPE_CATEGORY, REPORT_TYPE_DESCRIPTIONS, REPORT_TYPE_LABELS } from '../constants'
import type { ReportFilters, ReportType } from '../types'

export function ReportDetailPage() {
  const { type } = useParams<{ type: string }>()
  const [filters, setFilters] = useState<ReportFilters>({})
  const [hasGenerated, setHasGenerated] = useState(false)

  const isValidType = !!type && type in REPORT_TYPE_LABELS
  const reportType = type as ReportType

  const { data, isLoading, isError, error, refetch } = useReportQuery(reportType, filters, { enabled: isValidType && hasGenerated })
  const exportMutation = useExportReportMutation()

  if (!isValidType) {
    return (
      <PageLayout>
        <ErrorState title="Unknown report type" message={`"${type}" isn't a recognized report.`} />
      </PageLayout>
    )
  }

  const handleGenerate = (nextFilters: ReportFilters) => {
    setFilters(nextFilters)
    setHasGenerated(true)
    // Same filters object twice (unchanged) wouldn't refire the query since the queryKey is
    // identical - refetch() covers that case explicitly.
    if (hasGenerated) refetch()
  }

  return (
    <PageLayout>
      <Link
        to="/reports"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-body)] mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Reports
      </Link>

      <PageHeader
        title={REPORT_TYPE_LABELS[reportType]}
        description={REPORT_TYPE_DESCRIPTIONS[reportType]}
        actions={
          <PageActions>
            <Can permission={PERMISSIONS.REPORTS_EXPORT}>
              <Button
                variant="secondary"
                leadingIcon={<Download className="w-3.5 h-3.5" />}
                disabled={!data}
                loading={exportMutation.isPending && exportMutation.variables?.format === 'CSV'}
                onClick={() => exportMutation.mutate({ type: reportType, filters, format: 'CSV' })}
              >
                Export CSV
              </Button>
              <Button
                variant="secondary"
                leadingIcon={<Download className="w-3.5 h-3.5" />}
                disabled={!data}
                loading={exportMutation.isPending && exportMutation.variables?.format === 'PDF'}
                onClick={() => exportMutation.mutate({ type: reportType, filters, format: 'PDF' })}
              >
                Export PDF
              </Button>
            </Can>
          </PageActions>
        }
      />

      <PageContent>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Filters" action={<span className="text-[11px] text-[var(--color-text-muted)]">{REPORT_CATEGORY_LABELS[REPORT_TYPE_CATEGORY[reportType]]}</span>} />
            <ReportFiltersForm onGenerate={handleGenerate} isGenerating={isLoading} />
          </Card>

          {exportMutation.isError && (
            <p className="text-[12px] text-[var(--color-danger)]">{normalizeApiError(exportMutation.error).message}</p>
          )}

          <Card>
            <CardHeader title="Result" />
            {!hasGenerated ? (
              <EmptyState icon={FileBarChart} title="No report generated yet" description="Set your filters above and click Generate report." />
            ) : isLoading ? (
              <Spinner fullScreen={false} label="Generating report…" className="py-12" />
            ) : isError ? (
              <ErrorState title="Couldn't generate this report" message={normalizeApiError(error).message} onRetry={refetch} />
            ) : data && data.rows.length > 0 ? (
              <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)]">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-[var(--color-border)]">
                      {Object.keys(data.rows[0]).map((key) => (
                        <th key={key} className="py-2.5 px-4 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {data.rows.map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((value, j) => (
                          <td key={j} className="py-2.5 px-4 text-[var(--color-text-body)]">
                            {String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={FileBarChart} title="No data for this range" description="Try widening your date range or clearing the staff filter." />
            )}
          </Card>
        </div>
      </PageContent>
    </PageLayout>
  )
}
