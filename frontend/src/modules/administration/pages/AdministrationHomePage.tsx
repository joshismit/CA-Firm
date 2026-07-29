// src/modules/administration/pages/AdministrationHomePage.tsx
// Administration hub - mirrors modules/settings/pages/SettingsHomePage.tsx's pattern: a real,
// static, navigable catalog of the 3 sections that already have routes, plus one real (if always-
// erroring today) stat per section computed from that section's own hook - not fabricated.
import { Link } from 'react-router-dom'
import { ArrowRight, UsersRound, Shield, KeyRound } from 'lucide-react'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Card } from '@/components/shared/Card/Card'
import { AdministrationNav } from '../components'
import { useUsersQuery } from '@/modules/users/hooks'
import { useRolesQuery } from '@/modules/roles/hooks'
import { usePermissionsQuery } from '@/modules/permissions/hooks'

export function AdministrationHomePage() {
  const usersQuery = useUsersQuery({ page: 1, limit: 1 })
  const rolesQuery = useRolesQuery({ page: 1, limit: 1 })
  const permissionsQuery = usePermissionsQuery()

  const sections = [
    {
      to: '/staff/users',
      label: 'Users',
      description: 'Invite staff, manage accounts, and control access.',
      icon: UsersRound,
      stat: usersQuery.isError ? '—' : (usersQuery.data?.meta.total ?? 0),
    },
    {
      to: '/staff/roles',
      label: 'Roles',
      description: 'Define roles and the permissions they grant.',
      icon: Shield,
      stat: rolesQuery.isError ? '—' : (rolesQuery.data?.meta.total ?? 0),
    },
    {
      to: '/staff/permissions',
      label: 'Permissions',
      description: 'Browse the full permission catalog (read-only).',
      icon: KeyRound,
      stat: permissionsQuery.isError ? '—' : (permissionsQuery.data?.length ?? 0),
    },
  ]

  return (
    <PageLayout>
      <PageHeader title="Administration" description="Manage users, roles, and permissions for your firm." />
      <PageContent>
        <div className="space-y-4">
          <AdministrationNav />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sections.map(({ to, label, description, icon: Icon, stat }) => (
              <Link key={to} to={to} className="block h-full">
                <Card className="h-full flex flex-col hover:border-[var(--color-primary-300)] hover:shadow-[var(--shadow-md)] transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-primary-50)] flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-[var(--color-primary-600)]" />
                    </div>
                    <span className="font-mono text-[18px] font-bold text-[var(--color-text-heading)]">{stat}</span>
                  </div>
                  <h3 className="mt-3 text-[14px] font-semibold text-[var(--color-text-heading)]">{label}</h3>
                  <p className="mt-1 text-[12px] text-[var(--color-text-muted)] flex-1">{description}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--color-primary-600)]">
                    Manage <ArrowRight className="w-3 h-3" />
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </PageContent>
    </PageLayout>
  )
}
