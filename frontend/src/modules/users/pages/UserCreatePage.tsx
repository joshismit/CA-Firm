// src/modules/users/pages/UserCreatePage.tsx
import { useNavigate } from 'react-router-dom'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Card } from '@/components/shared/Card/Card'
import { normalizeApiError } from '@/services/api-error'
import { useInviteUserMutation } from '../hooks'
import { UserForm } from '../components'
import type { InviteUserFormValues } from '../schemas'

export function UserCreatePage() {
  const navigate = useNavigate()
  const inviteMutation = useInviteUserMutation()

  const handleInvite = (values: InviteUserFormValues) => {
    inviteMutation.mutate(values, {
      onSuccess: () => navigate('/staff/users'),
    })
  }

  return (
    <PageLayout>
      <PageHeader title="Invite User" description="Send an invitation to join your firm's account." />
      <PageContent>
        <Card>
          <UserForm
            mode="invite"
            onInvite={handleInvite}
            isSubmitting={inviteMutation.isPending}
            submitError={inviteMutation.isError ? normalizeApiError(inviteMutation.error).message : undefined}
          />
        </Card>
      </PageContent>
    </PageLayout>
  )
}
