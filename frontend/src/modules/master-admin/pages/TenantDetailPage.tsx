// src/modules/master-admin/pages/TenantDetailPage.tsx
// Single tenant view: usage stats (PRD §4.1 "view usage and storage") plus the two admin actions
// this portal supports - change status (enable/disable/suspend) and change plan/limits. Plain
// useState forms rather than react-hook-form - this is a small internal admin utility with two
// independent, unrelated actions, not a single validated create/edit form.
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, FileText, HardDrive, Users } from 'lucide-react'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { StatCard, StatsGrid } from '@/components/shared/StatCard/StatCard'
import { Spinner, ErrorState } from '@/components/feedback'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { normalizeApiError } from '@/services/api-error'
import { formatDate } from '@/lib/utils'
import { useTenantQuery, useUpdateTenantLimitsMutation, useUpdateTenantStatusMutation } from '../hooks'
import { TenantStatusBadge } from '../components'
import { TENANT_STATUS_LABELS } from '../constants'
import type { TenantStatus } from '../types'

const STATUS_OPTIONS = Object.entries(TENANT_STATUS_LABELS).map(([value, label]) => ({ value, label }))

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`
}

export function TenantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: tenant, isLoading, isError, error, refetch } = useTenantQuery(id!)

  const [status, setStatus] = useState<TenantStatus>('ACTIVE')
  const [planCode, setPlanCode] = useState('')
  const [maxUsers, setMaxUsers] = useState('')
  const [maxClients, setMaxClients] = useState('')
  const [maxStorageGb, setMaxStorageGb] = useState('')
  const [maxDocuments, setMaxDocuments] = useState('')

  useEffect(() => {
    if (!tenant) return
    setStatus(tenant.status)
    setPlanCode(tenant.planCode ?? '')
    setMaxUsers(tenant.maxUsers?.toString() ?? '')
    setMaxClients(tenant.maxClients?.toString() ?? '')
    setMaxStorageGb(tenant.maxStorageGb?.toString() ?? '')
    setMaxDocuments(tenant.maxDocuments?.toString() ?? '')
  }, [tenant])

  const statusMutation = useUpdateTenantStatusMutation(id!)
  const limitsMutation = useUpdateTenantLimitsMutation(id!)

  if (isLoading) {
    return (
      <PageLayout>
        <Spinner fullScreen={false} label="Loading tenant…" className="py-16" />
      </PageLayout>
    )
  }

  if (isError || !tenant) {
    return (
      <PageLayout>
        <ErrorState
          title="Couldn't load this tenant"
          message={error ? normalizeApiError(error).message : 'Tenant not found.'}
          onRetry={refetch}
        />
      </PageLayout>
    )
  }

  const toNullableInt = (value: string): number | null => (value.trim() === '' ? null : Number(value))

  return (
    <PageLayout>
      <Link
        to="/master-admin/tenants"
        className="inline-flex items-center gap-1.5 text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] mb-3"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All tenants
      </Link>

      <PageHeader
        title={tenant.name}
        description={`${tenant.slug} · Created ${formatDate(tenant.createdAt)}`}
        actions={<TenantStatusBadge status={tenant.status} />}
      />

      <PageContent>
        <StatsGrid>
          <StatCard label="Users" value={tenant.usage.userCount} icon={Users} />
          <StatCard label="Businesses" value={tenant.usage.businessCount} icon={Building2} />
          <StatCard label="Clients" value={tenant.usage.clientCount} icon={Building2} />
          <StatCard label="Documents" value={tenant.usage.documentCount} icon={FileText} hint={formatBytes(tenant.usage.storageUsedBytes)} />
        </StatsGrid>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <Card>
            <CardHeader title="Status" />
            <p className="text-[12px] text-[var(--color-text-muted)] mb-3">
              Activate, suspend, or deactivate this tenant's access to the platform.
            </p>
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="tenant-status">Status</Label>
                <Select
                  value={status}
                  onChange={(value) => setStatus(value as TenantStatus)}
                  options={STATUS_OPTIONS}
                  className="h-10 w-full"
                />
              </div>
              <Button
                variant="primary"
                loading={statusMutation.isPending}
                disabled={status === tenant.status}
                onClick={() => statusMutation.mutate({ status })}
              >
                Save
              </Button>
            </div>
            {statusMutation.isError && (
              <p className="mt-2 text-[12px] text-[var(--color-danger)]">{normalizeApiError(statusMutation.error).message}</p>
            )}
          </Card>

          <Card>
            <CardHeader title="Plan &amp; limits" />
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="plan-code">Plan code</Label>
                <Input id="plan-code" value={planCode} onChange={(e) => setPlanCode(e.target.value)} placeholder="e.g. professional" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max-users">Max users</Label>
                <Input id="max-users" type="number" min={0} value={maxUsers} onChange={(e) => setMaxUsers(e.target.value)} placeholder="Unlimited" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max-clients">Max clients</Label>
                <Input id="max-clients" type="number" min={0} value={maxClients} onChange={(e) => setMaxClients(e.target.value)} placeholder="Unlimited" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max-storage">Max storage (GB)</Label>
                <Input id="max-storage" type="number" min={0} value={maxStorageGb} onChange={(e) => setMaxStorageGb(e.target.value)} placeholder="Unlimited" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max-documents">Max documents</Label>
                <Input id="max-documents" type="number" min={0} value={maxDocuments} onChange={(e) => setMaxDocuments(e.target.value)} placeholder="Unlimited" />
              </div>
            </div>
            <Button
              variant="primary"
              className="mt-3"
              loading={limitsMutation.isPending}
              onClick={() =>
                limitsMutation.mutate({
                  planCode: planCode.trim() === '' ? null : planCode.trim(),
                  maxUsers: toNullableInt(maxUsers),
                  maxClients: toNullableInt(maxClients),
                  maxStorageGb: toNullableInt(maxStorageGb),
                  maxDocuments: toNullableInt(maxDocuments),
                })
              }
            >
              Save plan &amp; limits
            </Button>
            {limitsMutation.isError && (
              <p className="mt-2 text-[12px] text-[var(--color-danger)]">{normalizeApiError(limitsMutation.error).message}</p>
            )}
          </Card>
        </div>
      </PageContent>
    </PageLayout>
  )
}
