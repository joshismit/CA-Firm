// src/modules/clients/components/ClientsQuickActions.tsx
// Real, permission-gated shortcuts into the two creation flows this hub actually composes
// (Business, Contact) - not a decorative action grid. Reuses Card/CardHeader/Button/Can rather than
// hand-rolled markup.
import { Building2, UserPlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { Button } from '@/components/ui/button'
import { Can } from '@/components/common/Can'
import { PERMISSIONS } from '@/config/permissions.config'

export function ClientsQuickActions() {
  const navigate = useNavigate()

  return (
    <Card padding="sm">
      <CardHeader title="Quick Actions" />
      <div className="flex flex-wrap items-center gap-2">
        <Can permission={PERMISSIONS.BUSINESS_CREATE}>
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Building2 className="w-3.5 h-3.5" />}
            onClick={() => navigate('/business/new')}
          >
            Add Business
          </Button>
        </Can>
        <Can permission={PERMISSIONS.CONTACTS_CREATE}>
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<UserPlus className="w-3.5 h-3.5" />}
            onClick={() => navigate('/contacts/new')}
          >
            Add Contact
          </Button>
        </Can>
      </div>
    </Card>
  )
}
