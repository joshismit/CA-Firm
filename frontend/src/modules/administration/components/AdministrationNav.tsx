// src/modules/administration/components/AdministrationNav.tsx
// Persistent cross-page navigation strip shown on every administration page (Home/Users/Roles/
// Permissions) - same pattern and reasoning as modules/settings/components/SettingsNav.tsx: these
// are sibling sections under one route prefix, so jumping between them is common enough to
// justify one shared nav component.
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

const ADMINISTRATION_NAV_ITEMS = [
  { to: '/staff', label: 'Overview', end: true },
  { to: '/staff/users', label: 'Users' },
  { to: '/staff/roles', label: 'Roles' },
  { to: '/staff/permissions', label: 'Permissions' },
]

export function AdministrationNav() {
  return (
    <nav className="flex items-center gap-1 border-b border-[var(--color-border)] overflow-x-auto" aria-label="Administration sections">
      {ADMINISTRATION_NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              '-mb-px inline-flex h-[34px] shrink-0 items-center gap-1.5 border-b-2 px-3',
              'text-[13px] font-medium transition-colors duration-150',
              isActive
                ? 'border-[var(--color-primary-600)] text-[var(--color-primary-700)]'
                : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-body)]'
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
