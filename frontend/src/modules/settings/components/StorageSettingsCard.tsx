// src/modules/settings/components/StorageSettingsCard.tsx
// PRD §7.4 — Upload Rules, Firm Settings → Storage. Unlike FirmSettingsForm/TeamSettingsForm
// above it (both still hitting the 501 stub), this section is wired to the real
// GET/PATCH /settings/storage endpoint. Plain useState rather than react-hook-form — mirrors
// master-admin's TenantDetailPage "Plan & limits" card: one small numeric-limit field with its own
// independent save action, not a multi-field validated form.
import { useEffect, useState } from 'react'
import { Info } from 'lucide-react'
import { Spinner, AlertBanner } from '@/components/feedback'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Can } from '@/components/common/Can'
import { PERMISSIONS } from '@/config/permissions.config'
import { normalizeApiError } from '@/services/api-error'
import { useStorageSettingsQuery, useUpdateStorageSettingsMutation } from '../hooks'
import { SettingsSection } from './SettingsSection'

export function StorageSettingsCard() {
  const { data, isLoading, isError, error, refetch } = useStorageSettingsQuery()
  const mutation = useUpdateStorageSettingsMutation()

  const [quotaInput, setQuotaInput] = useState('')
  const [validationError, setValidationError] = useState<string | undefined>()

  useEffect(() => {
    if (!data) return
    setQuotaInput(data.defaultBusinessStorageQuotaMb != null ? String(data.defaultBusinessStorageQuotaMb) : '')
  }, [data])

  const handleSave = () => {
    setValidationError(undefined)

    if (quotaInput.trim() === '') {
      mutation.mutate({ defaultBusinessStorageQuotaMb: null })
      return
    }

    const parsed = Number(quotaInput)
    if (!Number.isInteger(parsed) || parsed < 1) {
      setValidationError('Enter a whole number of at least 1 MB, or leave blank to use the platform default.')
      return
    }
    mutation.mutate({ defaultBusinessStorageQuotaMb: parsed })
  }

  const isDirty = data ? quotaInput !== (data.defaultBusinessStorageQuotaMb != null ? String(data.defaultBusinessStorageQuotaMb) : '') : false

  return (
    <SettingsSection title="Storage" description="Upload size limits and the default storage quota for new businesses.">
      {isLoading ? (
        <Spinner fullScreen={false} label="Loading storage settings…" className="py-8" />
      ) : isError ? (
        <AlertBanner
          variant="danger"
          message={`Couldn't load storage settings (${normalizeApiError(error).message}).`}
          action={
            <button onClick={() => refetch()} className="text-[11px] font-semibold text-[var(--color-danger)] hover:underline shrink-0">
              Try again
            </button>
          }
        />
      ) : data ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Maximum upload size</Label>
            <p className="text-[13px] text-[var(--color-text-body)]">{data.maxUploadSizeMb} MB per file</p>
            <p className="flex items-start gap-1.5 text-[11px] text-[var(--color-text-muted)]">
              <Info className="w-3 h-3 mt-0.5 shrink-0" />
              Determined by your subscription plan. Contact support to change it.
            </p>
          </div>

          <Can permission={PERMISSIONS.SETTINGS_MANAGE}>
            <div className="space-y-1.5 max-w-xs">
              <Label htmlFor="default-business-quota">Default business quota (MB)</Label>
              <Input
                id="default-business-quota"
                type="number"
                min={1}
                value={quotaInput}
                onChange={(e) => setQuotaInput(e.target.value)}
                placeholder="500 (platform default)"
                invalid={!!validationError}
              />
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Applied to businesses that don't have their own storage quota override. Leave blank to use the 500 MB platform default.
              </p>
              {validationError && <p className="text-[12px] text-[var(--color-danger)]">{validationError}</p>}
              {mutation.isError && <p className="text-[12px] text-[var(--color-danger)]">{normalizeApiError(mutation.error).message}</p>}
              <div className="flex justify-end pt-1">
                <Button size="sm" loading={mutation.isPending} disabled={!isDirty} onClick={handleSave}>
                  Save
                </Button>
              </div>
            </div>
          </Can>
        </div>
      ) : null}
    </SettingsSection>
  )
}
