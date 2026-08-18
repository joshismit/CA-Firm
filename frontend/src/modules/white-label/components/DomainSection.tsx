// src/modules/white-label/components/DomainSection.tsx
// Three states: no domain configured (offer subdomain OR custom domain), a platform subdomain
// (always verified immediately - nothing more to do), or a custom domain pending/verified.
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Globe, CheckCircle2, Clock, Copy, Trash2 } from 'lucide-react'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { subdomainFormSchema, customDomainFormSchema, type SubdomainFormValues, type CustomDomainFormValues } from '../schemas'
import type { TenantDomain, CreateTenantDomainPayload } from '../types'

export interface DomainSectionProps {
  domain: TenantDomain | null | undefined
  onCreate: (payload: CreateTenantDomainPayload) => void
  onVerify: () => void
  onDelete: () => void
  isCreating?: boolean
  isVerifying?: boolean
  isDeleting?: boolean
  createError?: string
  canManage: boolean
}

export function DomainSection({ domain, onCreate, onVerify, onDelete, isCreating, isVerifying, isDeleting, createError, canManage }: DomainSectionProps) {
  const [mode, setMode] = useState<'subdomain' | 'custom'>('subdomain')

  const subdomainForm = useForm<SubdomainFormValues>({ resolver: zodResolver(subdomainFormSchema), defaultValues: { subdomain: '' } })
  const customDomainForm = useForm<CustomDomainFormValues>({ resolver: zodResolver(customDomainFormSchema), defaultValues: { customDomain: '' } })

  if (domain) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
          <div className="flex items-center gap-3">
            <Globe className="w-4 h-4 text-[var(--color-text-muted)]" />
            <div>
              <p className="text-[13px] font-medium text-[var(--color-text-body)]">{domain.domain}</p>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                {domain.subdomain ? 'Platform subdomain' : 'Custom domain'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge variant={domain.isVerified ? 'success' : 'warning'} dot>
              {domain.isVerified ? 'Verified' : 'Pending verification'}
            </StatusBadge>
            {canManage && (
              <Button type="button" variant="ghost" size="sm" onClick={onDelete} loading={isDeleting} aria-label="Remove domain">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        {!domain.isVerified && domain.verification && (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-4 space-y-3">
            <p className="text-[12px] text-[var(--color-warning-fg)] flex items-start gap-2">
              <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Add this TXT record at your DNS provider to prove ownership, then verify:
            </p>
            <dl className="space-y-2 text-[12px] font-mono">
              <div>
                <dt className="text-[var(--color-text-muted)]">Name</dt>
                <dd className="flex items-center gap-2 text-[var(--color-text-body)]">
                  {domain.verification.recordName}
                  <CopyButton value={domain.verification.recordName} />
                </dd>
              </div>
              <div>
                <dt className="text-[var(--color-text-muted)]">Value</dt>
                <dd className="flex items-center gap-2 text-[var(--color-text-body)]">
                  {domain.verification.recordValue}
                  <CopyButton value={domain.verification.recordValue} />
                </dd>
              </div>
            </dl>
            {canManage && (
              <Button type="button" variant="secondary" size="sm" onClick={onVerify} loading={isVerifying}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                Check now
              </Button>
            )}
          </div>
        )}
      </div>
    )
  }

  if (!canManage) {
    return <p className="text-[12px] text-[var(--color-text-muted)]">No domain is configured for your firm yet.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-[var(--radius-md)] bg-[var(--color-surface)] p-1 w-fit">
        <button
          type="button"
          onClick={() => setMode('subdomain')}
          className={`px-3 py-1.5 text-[12px] font-medium rounded-[var(--radius-sm)] ${mode === 'subdomain' ? 'bg-[var(--color-bg)] text-[var(--color-text-body)] shadow-sm' : 'text-[var(--color-text-muted)]'}`}
        >
          Platform subdomain
        </button>
        <button
          type="button"
          onClick={() => setMode('custom')}
          className={`px-3 py-1.5 text-[12px] font-medium rounded-[var(--radius-sm)] ${mode === 'custom' ? 'bg-[var(--color-bg)] text-[var(--color-text-body)] shadow-sm' : 'text-[var(--color-text-muted)]'}`}
        >
          Custom domain
        </button>
      </div>

      {mode === 'subdomain' ? (
        <form
          className="flex items-end gap-3"
          onSubmit={subdomainForm.handleSubmit((values) => onCreate({ subdomain: values.subdomain }))}
          noValidate
        >
          <FormField label="Subdomain" htmlFor="subdomain" error={subdomainForm.formState.errors.subdomain?.message} className="flex-1">
            <div className="flex items-center">
              <Input id="subdomain" placeholder="yourfirm" invalid={!!subdomainForm.formState.errors.subdomain} {...subdomainForm.register('subdomain')} />
              <span className="ml-2 text-[12px] text-[var(--color-text-muted)] whitespace-nowrap">.cafirmapp.com</span>
            </div>
          </FormField>
          <Button type="submit" variant="primary" loading={isCreating}>
            Claim subdomain
          </Button>
        </form>
      ) : (
        <form
          className="flex items-end gap-3"
          onSubmit={customDomainForm.handleSubmit((values) => onCreate({ customDomain: values.customDomain }))}
          noValidate
        >
          <FormField label="Custom domain" htmlFor="customDomain" error={customDomainForm.formState.errors.customDomain?.message} className="flex-1">
            <Input id="customDomain" placeholder="portal.yourfirm.com" invalid={!!customDomainForm.formState.errors.customDomain} {...customDomainForm.register('customDomain')} />
          </FormField>
          <Button type="submit" variant="primary" loading={isCreating}>
            Add domain
          </Button>
        </form>
      )}

      {createError && <p className="text-[12px] text-[var(--color-danger)]">{createError}</p>}
    </div>
  )
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="text-[var(--color-text-muted)] hover:text-[var(--color-text-body)]"
      aria-label="Copy to clipboard"
    >
      {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </button>
  )
}
