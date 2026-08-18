// src/modules/business/components/BusinessStorageCard.tsx
// PRD §7.4 — Upload Rules, Business Details → Storage. Storage Used / Remaining / a quota
// progress bar, plus an inline quota-override editor — mirrors master-admin's TenantDetailPage
// "Plan & limits" card (its own independent save action, plain useState, not folded into the
// generic BusinessForm which is shared with the 'create' payload that doesn't accept this field).
import { useEffect, useState } from 'react'
import { HardDrive } from 'lucide-react'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Can } from '@/components/common/Can'
import { PERMISSIONS } from '@/config/permissions.config'
import { normalizeApiError } from '@/services/api-error'
import { formatFileSize } from '@/lib/utils'
import { useUpdateBusinessMutation } from '../hooks'
import type { Business } from '../types'

export interface BusinessStorageCardProps {
  business: Business
}

export function BusinessStorageCard({ business }: BusinessStorageCardProps) {
  const usage = business.storageUsage
  const mutation = useUpdateBusinessMutation(business.id)

  const [quotaInput, setQuotaInput] = useState(business.storageQuotaMb != null ? String(business.storageQuotaMb) : '')
  const [validationError, setValidationError] = useState<string | undefined>()

  useEffect(() => {
    setQuotaInput(business.storageQuotaMb != null ? String(business.storageQuotaMb) : '')
  }, [business.storageQuotaMb])

  if (!usage) return null

  const percentUsed = usage.quotaBytes > 0 ? Math.min(100, Math.round((usage.usedBytes / usage.quotaBytes) * 100)) : 0
  const tone = percentUsed >= 100 ? 'danger' : percentUsed >= 80 ? 'warning' : 'primary'

  const isDirty = quotaInput !== (business.storageQuotaMb != null ? String(business.storageQuotaMb) : '')

  const handleSave = () => {
    setValidationError(undefined)

    if (quotaInput.trim() === '') {
      mutation.mutate({ storageQuotaMb: null })
      return
    }

    const parsed = Number(quotaInput)
    if (!Number.isInteger(parsed) || parsed < 1) {
      setValidationError('Enter a whole number of at least 1 MB, or leave blank to use the firm default.')
      return
    }
    mutation.mutate({ storageQuotaMb: parsed })
  }

  return (
    <Card>
      <CardHeader title="Storage" />
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-50)] shrink-0">
            <HardDrive className="w-4 h-4 text-[var(--color-primary-600)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] font-medium text-[var(--color-text-body)]">
                {formatFileSize(usage.usedBytes)} used
              </span>
              <span className="text-[11px] text-[var(--color-text-muted)]">
                {formatFileSize(usage.remainingBytes)} remaining of {formatFileSize(usage.quotaBytes)}
              </span>
            </div>
            <Progress value={percentUsed} tone={tone} className="mt-1.5" />
          </div>
        </div>

        <Can permission={PERMISSIONS.BUSINESS_UPDATE}>
          <div className="space-y-1.5 max-w-xs border-t border-[var(--color-border)] pt-3">
            <Label htmlFor={`storage-quota-${business.id}`}>Storage quota override (MB)</Label>
            <div className="flex items-end gap-2">
              <Input
                id={`storage-quota-${business.id}`}
                type="number"
                min={1}
                value={quotaInput}
                onChange={(e) => setQuotaInput(e.target.value)}
                placeholder="Firm default"
                invalid={!!validationError}
                className="flex-1"
              />
              <Button size="sm" loading={mutation.isPending} disabled={!isDirty} onClick={handleSave}>
                Save
              </Button>
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)]">Leave blank to use the firm's default business quota.</p>
            {validationError && <p className="text-[12px] text-[var(--color-danger)]">{validationError}</p>}
            {mutation.isError && <p className="text-[12px] text-[var(--color-danger)]">{normalizeApiError(mutation.error).message}</p>}
          </div>
        </Can>
      </div>
    </Card>
  )
}
