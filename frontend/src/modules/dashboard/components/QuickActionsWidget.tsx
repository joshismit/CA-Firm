// src/modules/dashboard/components/QuickActionsWidget.tsx
// Real, permission-gated navigation shortcuts into the actual creation flows this app has -
// nothing decorative, no dead buttons (the previous dashboard's Quick Actions footer had four
// buttons with no onClick at all - see the module's completion report for that fix).
import { useNavigate } from 'react-router-dom'
import { Landmark, IdCard, Briefcase, Upload, Handshake } from 'lucide-react'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { Can } from '@/components/common/Can'
import { PERMISSIONS } from '@/config/permissions.config'
import { cn } from '@/lib/utils'

// No "New Task" action - unlike Business/Contacts/CRM/Projects, the Tasks module has no
// /tasks/new create route (only List/Detail pages exist today), so a shortcut here would land on
// a list instead of a create form. Only real, navigable creation flows are listed.
const ACTIONS = [
  { label: 'New Business', icon: Landmark, to: '/business/new', permission: PERMISSIONS.BUSINESS_CREATE },
  { label: 'New Contact', icon: IdCard, to: '/contacts/new', permission: PERMISSIONS.CONTACTS_CREATE },
  { label: 'New Lead', icon: Handshake, to: '/crm/new', permission: PERMISSIONS.CRM_CREATE },
  { label: 'New Project', icon: Briefcase, to: '/projects/new', permission: PERMISSIONS.PROJECTS_CREATE },
  { label: 'Upload Document', icon: Upload, to: '/documents/upload', permission: PERMISSIONS.DOCUMENTS_CREATE },
] as const

export function QuickActionsWidget() {
  const navigate = useNavigate()

  return (
    <Card>
      <CardHeader title="Quick Actions" />
      <div className="grid grid-cols-2 gap-2">
        {ACTIONS.map(({ label, icon: Icon, to, permission }) => (
          <Can key={label} permission={permission}>
            <button
              onClick={() => navigate(to)}
              className={cn(
                'flex items-center gap-2.5 p-3 rounded-[var(--radius-md)]',
                'border border-[var(--color-border)] text-[var(--color-text-secondary)]',
                'text-[12px] font-medium transition-all duration-150',
                'hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary-700)] hover:border-[var(--color-primary-200)]'
              )}
            >
              <Icon className="w-4 h-4 shrink-0 text-[var(--color-primary-600)]" />
              {label}
            </button>
          </Can>
        ))}
      </div>
    </Card>
  )
}
