// src/modules/settings/pages/ProfileSettingsPage.tsx
// Real page against real endpoints - GET /auth/me, POST /auth/change-password, GET/DELETE
// /auth/sessions* all genuinely exist on the backend (unlike every other Settings section). There
// is no PATCH /auth/me yet, so the profile overview below is read-only - editing it would mean
// inventing an endpoint that doesn't exist, which the rest of this phase's work has consistently
// avoided.
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Spinner, ErrorState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { formatDateLong } from '@/lib/utils'
import { useMeQuery } from '@/modules/auth/hooks'
import { SettingsNav, SettingsSection, ChangePasswordForm, SessionsList } from '../components'

export function ProfileSettingsPage() {
  const { data: me, isLoading, isError, error, refetch } = useMeQuery()

  return (
    <PageLayout>
      <PageHeader title="Profile Settings" description="Your account details, password, and active sessions." />
      <PageContent>
        <div className="space-y-4">
          <SettingsNav />

          <SettingsSection title="Overview">
            {isLoading ? (
              <Spinner fullScreen={false} label="Loading profile…" className="py-8" />
            ) : isError ? (
              <ErrorState title="Couldn't load your profile" message={normalizeApiError(error).message} onRetry={refetch} className="py-8" />
            ) : me ? (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px]">
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Name</dt>
                  <dd className="mt-0.5 text-[var(--color-text-body)]">{me.firstName} {me.lastName}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Email</dt>
                  <dd className="mt-0.5 text-[var(--color-text-body)]">{me.email}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Job title</dt>
                  <dd className="mt-0.5 text-[var(--color-text-body)]">{me.jobTitle ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Phone</dt>
                  <dd className="mt-0.5 text-[var(--color-text-body)]">{me.phone ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Last login</dt>
                  <dd className="mt-0.5 text-[var(--color-text-body)]">{me.lastLoginAt ? formatDateLong(me.lastLoginAt) : '—'}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Member since</dt>
                  <dd className="mt-0.5 text-[var(--color-text-body)]">{formatDateLong(me.createdAt)}</dd>
                </div>
              </dl>
            ) : null}
          </SettingsSection>

          <SettingsSection title="Change Password">
            <ChangePasswordForm />
          </SettingsSection>

          <SettingsSection title="Active Sessions" description="Devices currently signed in to your account.">
            <SessionsList />
          </SettingsSection>
        </div>
      </PageContent>
    </PageLayout>
  )
}
